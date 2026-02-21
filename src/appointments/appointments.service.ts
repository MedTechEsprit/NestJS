import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from './schemas/appointment.schema';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
  ) {}

  /**
   * Create a new appointment
   */
  async create(createDto: CreateAppointmentDto): Promise<any> {
    // Validate that dateTime is in the future
    const appointmentDate = new Date(createDto.dateTime);
    if (appointmentDate < new Date()) {
      throw new BadRequestException('Appointment date must be in the future');
    }

    // Check for conflicting appointments for the doctor
    const existingAppointment = await this.appointmentModel.findOne({
      doctorId: new Types.ObjectId(createDto.doctorId),
      dateTime: appointmentDate,
      status: { $ne: AppointmentStatus.CANCELLED },
    });

    if (existingAppointment) {
      throw new BadRequestException('Doctor already has an appointment at this time');
    }

    const appointment = new this.appointmentModel({
      patientId: new Types.ObjectId(createDto.patientId),
      doctorId: new Types.ObjectId(createDto.doctorId),
      dateTime: appointmentDate,
      type: createDto.type,
      notes: createDto.notes || '',
    });

    const saved = await appointment.save();
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
  async update(id: string, updateDto: UpdateAppointmentDto): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID');
    }

    const appointment = await this.appointmentModel.findById(id).exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
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
      appointment.status = updateDto.status;
    }

    // Update notes if provided
    if (updateDto.notes !== undefined) {
      appointment.notes = updateDto.notes;
    }

    const updated = await appointment.save();
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
}
