import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Appointment, AppointmentDocument, AppointmentStatus } from './schemas/appointment.schema';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AppointmentsService {
  private static readonly MAX_APPOINTMENTS_PER_DAY = 15;
  private static readonly DOCTOR_CREATED_CONFIRMATION_WINDOW_MS =
    24 * 60 * 60 * 1000;

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Create a new appointment
   */
  async create(
    createDto: CreateAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<any> {
    // Validate that dateTime is in the future
    const appointmentDate = new Date(createDto.dateTime);
    if (appointmentDate < new Date()) {
      throw new BadRequestException('Appointment date must be in the future');
    }

    const normalizedRole = String(requesterRole || '').toUpperCase();
    let effectiveDoctorId = createDto.doctorId;

    if (normalizedRole === Role.MEDECIN) {
      // Always trust doctor identity from token for doctor-created appointments.
      effectiveDoctorId = requesterId;
      await this.assertDoctorCanAccessPatient(effectiveDoctorId, createDto.patientId);
    } else if (normalizedRole === Role.PATIENT) {
      if (createDto.patientId !== requesterId) {
        throw new BadRequestException('Patient can only create own appointments');
      }

      await this.assertDoctorCanAccessPatient(createDto.doctorId, createDto.patientId);
    } else {
      throw new BadRequestException('Only patient or doctor can create appointments');
    }

    const sameDayCount = await this.countDoctorAppointmentsForDay(
      effectiveDoctorId,
      appointmentDate,
    );
    if (sameDayCount >= AppointmentsService.MAX_APPOINTMENTS_PER_DAY) {
      throw new BadRequestException(
        `Maximum ${AppointmentsService.MAX_APPOINTMENTS_PER_DAY} appointments per day reached for this doctor`,
      );
    }

    // Check for conflicting appointments for the doctor
    const existingAppointment = await this.appointmentModel.findOne({
      doctorId: new Types.ObjectId(effectiveDoctorId),
      dateTime: appointmentDate,
      status: { $ne: AppointmentStatus.CANCELLED },
    });

    if (existingAppointment) {
      throw new BadRequestException('Doctor already has an appointment at this time');
    }

    const appointment = new this.appointmentModel({
      patientId: new Types.ObjectId(createDto.patientId),
      doctorId: new Types.ObjectId(effectiveDoctorId),
      dateTime: appointmentDate,
      type: createDto.type,
      notes: createDto.notes || '',
      status: AppointmentStatus.PENDING,
      createdByRole:
        normalizedRole === Role.MEDECIN ? Role.MEDECIN : Role.PATIENT,
      expiresAt:
        normalizedRole === Role.MEDECIN
          ? new Date(
              Date.now() +
                AppointmentsService.DOCTOR_CREATED_CONFIRMATION_WINDOW_MS,
            )
          : null,
      patientConfirmedAt: null,
    });

    const saved = await appointment.save();

    if (normalizedRole === Role.PATIENT) {
      // Trigger: notify doctor when a patient submits a new appointment request.
      await this.firebaseService.sendToUser(
        createDto.doctorId,
        'doctor',
        'Nouvelle demande de consultation',
        'Un patient a créé une nouvelle demande de rendez-vous.',
        {
          appointmentId: String((saved as any)._id),
          patientId: String(createDto.patientId),
          doctorId: String(effectiveDoctorId),
        },
      );
    } else if (normalizedRole === Role.MEDECIN) {
      // Trigger: notify patient when doctor creates an appointment awaiting confirmation.
      await this.firebaseService.sendToUser(
        createDto.patientId,
        'patient',
        'Confirmation requise du rendez-vous',
        'Votre médecin a programmé un rendez-vous. Merci de le confirmer sous 24h.',
        {
          appointmentId: String((saved as any)._id),
          patientId: String(createDto.patientId),
          doctorId: String(effectiveDoctorId),
        },
      );
    }

    return this.populateAppointment(saved);
  }

  /**
   * Get all appointments for a doctor with optional filtering
   */
  async findByDoctor(
    doctorId: string,
    paginationDto: PaginationDto,
    status?: AppointmentStatus,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {
      doctorId: new Types.ObjectId(doctorId),
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.dateTime = {};
      if (startDate) {
        query.dateTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.dateTime.$lte = new Date(endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.appointmentModel
        .find(query)
        .populate('patientId', 'prenom nom email telephone')
        .populate('doctorId', 'prenom nom email specialite')
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.appointmentModel.countDocuments(query).exec(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get all appointments for a patient with pagination
   */
  async findByPatient(patientId: string, paginationDto: PaginationDto): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.appointmentModel
        .find({ patientId: new Types.ObjectId(patientId) })
        .populate('doctorId', 'prenom nom email specialite')
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.appointmentModel.countDocuments({ patientId: new Types.ObjectId(patientId) }).exec(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get a single appointment by ID
   */
  async findOne(id: string): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID');
    }

    const appointment = await this.appointmentModel
      .findById(id)
      .populate('patientId', 'prenom nom email telephone')
      .populate('doctorId', 'prenom nom email specialite')
      .exec();

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  /**
   * Update appointment status and notes
   */
  async update(
    id: string,
    updateDto: UpdateAppointmentDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID');
    }

    const appointment = await this.appointmentModel.findById(id).exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const previousStatus = appointment.status;
    const normalizedRole = String(requesterRole || '').toUpperCase();
    const isDoctorRequester = normalizedRole === Role.MEDECIN;
    const isPatientRequester = normalizedRole === Role.PATIENT;

    if (!isDoctorRequester && !isPatientRequester) {
      throw new BadRequestException('Only patient or doctor can update appointments');
    }

    if (
      isDoctorRequester &&
      String(appointment.doctorId) !== String(requesterId)
    ) {
      throw new BadRequestException('Doctor can only update own appointments');
    }

    if (
      isPatientRequester &&
      String(appointment.patientId) !== String(requesterId)
    ) {
      throw new BadRequestException('Patient can only update own appointments');
    }

    // Cannot update cancelled appointments
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled appointment');
    }

    // Update dateTime if provided and validate it's in the future
    if (updateDto.dateTime) {
      const newDateTime = new Date(updateDto.dateTime);
      if (newDateTime < new Date()) {
        throw new BadRequestException('Appointment date must be in the future');
      }

      // Check for conflicting appointments if datetime changes
      if (newDateTime.getTime() !== appointment.dateTime.getTime()) {
        const sameDayCount = await this.countDoctorAppointmentsForDay(
          String(appointment.doctorId),
          newDateTime,
          id,
        );
        if (sameDayCount >= AppointmentsService.MAX_APPOINTMENTS_PER_DAY) {
          throw new BadRequestException(
            `Maximum ${AppointmentsService.MAX_APPOINTMENTS_PER_DAY} appointments per day reached for this doctor`,
          );
        }

        const conflictingAppointment = await this.appointmentModel.findOne({
          _id: { $ne: id },
          doctorId: appointment.doctorId,
          dateTime: newDateTime,
          status: { $ne: AppointmentStatus.CANCELLED },
        });

        if (conflictingAppointment) {
          throw new BadRequestException('Doctor already has an appointment at this time');
        }
      }

      appointment.dateTime = newDateTime;
    }

    // Update type if provided
    if (updateDto.type !== undefined) {
      appointment.type = updateDto.type;
    }

    // Update status if provided
    if (updateDto.status) {
      if (isPatientRequester && updateDto.status === AppointmentStatus.COMPLETED) {
        throw new BadRequestException('Patient cannot mark appointment as completed');
      }

      appointment.status = updateDto.status;

      if (updateDto.status !== AppointmentStatus.PENDING) {
        appointment.expiresAt = undefined;
      }
    }

    // Update notes if provided
    if (updateDto.notes !== undefined) {
      appointment.notes = updateDto.notes;
    }

    const updated = await appointment.save();

    if (updateDto.status && updateDto.status !== previousStatus) {
      if (isDoctorRequester) {
        // Trigger: notify patient when doctor validates/rejects/updates appointment status.
        await this.firebaseService.sendToUser(
          String(appointment.patientId),
          'patient',
          'Mise à jour de rendez-vous',
          `Le statut de votre rendez-vous est maintenant: ${updateDto.status}`,
          {
            appointmentId: String(appointment._id),
            patientId: String(appointment.patientId),
            doctorId: String(appointment.doctorId),
            status: String(updateDto.status),
          },
        );
      } else {
        // Trigger: notify doctor when patient updates appointment status.
        await this.firebaseService.sendToUser(
          String(appointment.doctorId),
          'doctor',
          'Rendez-vous modifié par le patient',
          `Le patient a mis à jour le statut du rendez-vous: ${updateDto.status}`,
          {
            appointmentId: String(appointment._id),
            patientId: String(appointment.patientId),
            doctorId: String(appointment.doctorId),
            status: String(updateDto.status),
          },
        );
      }
    }

    return this.populateAppointment(updated);
  }

  async confirmByPatient(appointmentId: string, patientId: string): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new BadRequestException('Invalid appointment ID');
    }

    const appointment = await this.appointmentModel.findById(appointmentId).exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (String(appointment.patientId) !== String(patientId)) {
      throw new BadRequestException('Patient can only confirm own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot confirm a cancelled appointment');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot confirm a completed appointment');
    }

    if (appointment.status === AppointmentStatus.CONFIRMED) {
      return this.populateAppointment(appointment);
    }

    if (appointment.createdByRole !== Role.MEDECIN) {
      throw new BadRequestException(
        'Patient confirmation is only required for doctor-created appointments',
      );
    }

    if (appointment.expiresAt && appointment.expiresAt.getTime() <= Date.now()) {
      appointment.status = AppointmentStatus.CANCELLED;
      appointment.expiresAt = undefined;
      await appointment.save();
      throw new BadRequestException(
        'Appointment expired after 24h without confirmation and was cancelled',
      );
    }

    appointment.status = AppointmentStatus.CONFIRMED;
    appointment.patientConfirmedAt = new Date();
    appointment.expiresAt = undefined;
    const updated = await appointment.save();

    await this.firebaseService.sendToUser(
      String(appointment.doctorId),
      'doctor',
      'Rendez-vous confirmé par le patient',
      'Le patient a confirmé sa présence au rendez-vous.',
      {
        appointmentId: String(appointment._id),
        patientId: String(appointment.patientId),
        doctorId: String(appointment.doctorId),
        status: String(appointment.status),
      },
    );

    return this.populateAppointment(updated);
  }

  /**
   * Delete an appointment
   */
  async remove(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID');
    }

    const appointment = await this.appointmentModel.findById(id).exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.appointmentModel.findByIdAndDelete(id).exec();
    return { message: 'Appointment deleted successfully' };
  }

  /**
   * Helper to populate appointments with user details
   */
  private async populateAppointment(appointment: any): Promise<any> {
    return this.appointmentModel
      .findById(appointment._id)
      .populate('patientId', 'prenom nom email telephone')
      .populate('doctorId', 'prenom nom email specialite')
      .exec();
  }

  /**
   * Get upcoming appointments for a doctor (next 7 days)
   */
  async getUpcomingAppointments(doctorId: string): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Explicit ObjectId conversion for proper MongoDB matching
    const appointments = await this.appointmentModel
      .find({
        doctorId: new Types.ObjectId(doctorId),
        dateTime: { $gte: now, $lte: sevenDaysLater },
        status: { $ne: AppointmentStatus.CANCELLED },
      })
      .populate('patientId', 'prenom nom email telephone')
      .populate('doctorId', 'prenom nom specialite')
      .sort({ dateTime: 1 })
      .limit(10)
      .exec();

    return appointments;
  }

  /**
   * Get appointment statistics for a doctor
   */
  async getAppointmentStats(doctorId: string): Promise<any> {
    await this.autoCancelExpiredDoctorCreatedAppointments();

    // Convert to ObjectId for aggregation pipeline
    const doctorObjectId = new Types.ObjectId(doctorId);
    const stats = await this.appointmentModel.aggregate([
      { $match: { doctorId: doctorObjectId } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          total: [{ $count: 'count' }],
          completed: [
            { $match: { status: AppointmentStatus.COMPLETED } },
            { $count: 'count' },
          ],
          cancelled: [
            { $match: { status: AppointmentStatus.CANCELLED } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    return {
      total: stats[0].total[0]?.count || 0,
      byStatus: stats[0].byStatus,
      completed: stats[0].completed[0]?.count || 0,
      cancelled: stats[0].cancelled[0]?.count || 0,
    };
  }

  private async assertDoctorCanAccessPatient(
    doctorId: string,
    patientId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(doctorId) || !Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('Invalid doctor or patient ID');
    }

    const doctor = await this.appointmentModel.db.collection('users').findOne({
      _id: new Types.ObjectId(doctorId),
      role: { $regex: '^medecin$', $options: 'i' } as any,
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const linkedPatients = ((doctor as any).listePatients || []).map((id: any) =>
      id.toString(),
    );

    if (!linkedPatients.includes(patientId)) {
      throw new BadRequestException('Doctor can only create appointments with own patients');
    }

    const accessMap = ((doctor as any).patientAccessMap || {}) as Record<string, any>;
    if (Object.prototype.hasOwnProperty.call(accessMap, patientId) && !accessMap[patientId]) {
      throw new BadRequestException('Patient access is not granted for this doctor');
    }
  }

  private async countDoctorAppointmentsForDay(
    doctorId: string,
    date: Date,
    excludeAppointmentId?: string,
  ): Promise<number> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const query: any = {
      doctorId: new Types.ObjectId(doctorId),
      dateTime: {
        $gte: dayStart,
        $lt: dayEnd,
      },
      status: { $ne: AppointmentStatus.CANCELLED },
    };

    if (excludeAppointmentId && Types.ObjectId.isValid(excludeAppointmentId)) {
      query._id = { $ne: new Types.ObjectId(excludeAppointmentId) };
    }

    return this.appointmentModel.countDocuments(query).exec();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAppointmentExpiryCron(): Promise<void> {
    await this.autoCancelExpiredDoctorCreatedAppointments();
  }

  private async autoCancelExpiredDoctorCreatedAppointments(): Promise<void> {
    const now = new Date();

    const expiredAppointments = await this.appointmentModel
      .find({
        status: AppointmentStatus.PENDING,
        createdByRole: Role.MEDECIN,
        expiresAt: { $lte: now },
      })
      .select('_id patientId doctorId')
      .lean()
      .exec();

    if (expiredAppointments.length === 0) {
      return;
    }

    await this.appointmentModel
      .updateMany(
        {
          status: AppointmentStatus.PENDING,
          createdByRole: Role.MEDECIN,
          expiresAt: { $lte: now },
        },
        {
          $set: {
            status: AppointmentStatus.CANCELLED,
            expiresAt: null,
            updatedAt: now,
          },
        },
      )
      .exec();

    for (const appointment of expiredAppointments) {
      await this.firebaseService.sendToUser(
        String(appointment.doctorId),
        'doctor',
        'Rendez-vous expiré automatiquement',
        'Le rendez-vous a été annulé car non confirmé par le patient sous 24h.',
        {
          appointmentId: String(appointment._id),
          patientId: String(appointment.patientId),
          doctorId: String(appointment.doctorId),
          status: AppointmentStatus.CANCELLED,
        },
      );

      await this.firebaseService.sendToUser(
        String(appointment.patientId),
        'patient',
        'Rendez-vous annulé automatiquement',
        'Ce rendez-vous a expiré après 24h sans confirmation.',
        {
          appointmentId: String(appointment._id),
          patientId: String(appointment.patientId),
          doctorId: String(appointment.doctorId),
          status: AppointmentStatus.CANCELLED,
        },
      );
    }
  }
}
