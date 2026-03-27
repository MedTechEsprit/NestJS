import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PatientRequest,
  PatientRequestDocument,
  PatientRequestStatus,
  PatientRequestType,
} from './schemas/patient-request.schema';
import { CreatePatientRequestDto, DeclineRequestDto } from './dto';
import { MedecinsService } from '../medecins/medecins.service';

@Injectable()
export class PatientRequestsService {
  constructor(
    @InjectModel(PatientRequest.name) private patientRequestModel: Model<PatientRequestDocument>,
    private medecinsService: MedecinsService,
  ) {}

  async create(patientId: string, createDto: CreatePatientRequestDto): Promise<PatientRequest> {
    const requestType = createDto.requestType ?? PatientRequestType.PATIENT_LINK;

    // Check if request already exists
    const existingFilter: any = {
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(createDto.doctorId),
      status: PatientRequestStatus.PENDING,
      requestType,
    };

    if (requestType === PatientRequestType.PATIENT_LINK) {
      existingFilter.$or = [
        { requestType: PatientRequestType.PATIENT_LINK },
        { requestType: { $exists: false } },
      ];
      delete existingFilter.requestType;
    }

    const existingRequest = await this.patientRequestModel.findOne(existingFilter);

    if (existingRequest) {
      throw new BadRequestException('A pending request to this doctor already exists');
    }

    const request = new this.patientRequestModel({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(createDto.doctorId),
      urgentNote: createDto.urgentNote,
      requestType,
      requestDate: new Date(),
    });

    return request.save();
  }

  async findPendingByDoctor(doctorId: string): Promise<PatientRequest[]> {
    return this.patientRequestModel
      .find({
        doctorId: new Types.ObjectId(doctorId),
        status: PatientRequestStatus.PENDING,
        $or: [
          { requestType: PatientRequestType.PATIENT_LINK },
          { requestType: { $exists: false } },
        ],
      })
      .populate('patientId', 'nom prenom email telephone')
      .sort({ requestDate: -1 })
      .exec();
  }

  async acceptRequest(doctorId: string, requestId: string): Promise<PatientRequest> {
    const request = await this.patientRequestModel.findOne({
      _id: new Types.ObjectId(requestId),
      doctorId: new Types.ObjectId(doctorId),
      status: PatientRequestStatus.PENDING,
      $or: [
        { requestType: PatientRequestType.PATIENT_LINK },
        { requestType: { $exists: false } },
      ],
    });

    if (!request) {
      throw new NotFoundException('Pending request not found');
    }

    // Update request status
    request.status = PatientRequestStatus.ACCEPTED;
    request.respondedAt = new Date();
    request.respondedByRole = 'MEDECIN';
    await request.save();

    // Add patient to doctor's patient list using MedecinsService
    // This now uses direct collection update to bypass schema strict mode
    await this.medecinsService.addPatient(doctorId, request.patientId.toString());

    return request;
  }

  async declineRequest(doctorId: string, requestId: string, declineDto: DeclineRequestDto): Promise<PatientRequest> {
    const request = await this.patientRequestModel.findOne({
      _id: new Types.ObjectId(requestId),
      doctorId: new Types.ObjectId(doctorId),
      status: PatientRequestStatus.PENDING,
    });

    if (!request) {
      throw new NotFoundException('Pending request not found');
    }

    request.status = PatientRequestStatus.DECLINED;
    request.declineReason = declineDto.declineReason;
    request.respondedAt = new Date();
    request.respondedByRole = 'MEDECIN';
    return request.save();
  }

  async findByPatient(patientId: string): Promise<PatientRequest[]> {
    return this.patientRequestModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('doctorId', 'nom prenom email telephone specialite')
      .sort({ requestDate: -1 })
      .exec();
  }

  async findPendingDoctorAccessRequestsByPatient(patientId: string): Promise<PatientRequest[]> {
    return this.patientRequestModel
      .find({
        patientId: new Types.ObjectId(patientId),
        status: PatientRequestStatus.PENDING,
        requestType: PatientRequestType.ACCESS_RENEWAL,
      })
      .populate('doctorId', 'nom prenom email telephone specialite')
      .sort({ requestDate: -1 })
      .exec();
  }

  async acceptDoctorAccessRequestByPatient(patientId: string, requestId: string): Promise<PatientRequest> {
    const request = await this.patientRequestModel.findOne({
      _id: new Types.ObjectId(requestId),
      patientId: new Types.ObjectId(patientId),
      status: PatientRequestStatus.PENDING,
      requestType: PatientRequestType.ACCESS_RENEWAL,
    });

    if (!request) {
      throw new NotFoundException('Demande d\'accès introuvable');
    }

    request.status = PatientRequestStatus.ACCEPTED;
    request.respondedAt = new Date();
    request.respondedByRole = 'PATIENT';
    request.authorizationEnabled = true;
    await request.save();

    await this.medecinsService.setPatientAccess(
      request.doctorId.toString(),
      patientId,
      true,
    );

    return request;
  }

  async declineDoctorAccessRequestByPatient(
    patientId: string,
    requestId: string,
    declineReason?: string,
  ): Promise<PatientRequest> {
    const request = await this.patientRequestModel.findOne({
      _id: new Types.ObjectId(requestId),
      patientId: new Types.ObjectId(patientId),
      status: PatientRequestStatus.PENDING,
      requestType: PatientRequestType.ACCESS_RENEWAL,
    });

    if (!request) {
      throw new NotFoundException('Demande d\'accès introuvable');
    }

    request.status = PatientRequestStatus.DECLINED;
    request.respondedAt = new Date();
    request.respondedByRole = 'PATIENT';
    request.authorizationEnabled = false;
    if (declineReason) {
      request.declineReason = declineReason;
    }

    return request.save();
  }

  async requestDoctorAccess(doctorId: string, patientId: string): Promise<PatientRequest> {
    const hasAccess = await this.medecinsService.hasPatientAccess(doctorId, patientId);
    if (hasAccess) {
      throw new BadRequestException('Le médecin a déjà l\'accès autorisé');
    }

    const existingPending = await this.patientRequestModel.findOne({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
      status: PatientRequestStatus.PENDING,
      requestType: PatientRequestType.ACCESS_RENEWAL,
    });

    if (existingPending) {
      throw new BadRequestException('Une demande d\'accès est déjà en attente');
    }

    const request = new this.patientRequestModel({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
      requestType: PatientRequestType.ACCESS_RENEWAL,
      status: PatientRequestStatus.PENDING,
      requestDate: new Date(),
    });

    return request.save();
  }

  async getDoctorAccessStatus(patientId: string, doctorId: string): Promise<{ enabled: boolean }> {
    const enabled = await this.medecinsService.hasPatientAccess(doctorId, patientId);
    return { enabled };
  }

  async setDoctorAccessByPatient(
    patientId: string,
    doctorId: string,
    enabled: boolean,
  ): Promise<{ enabled: boolean }> {
    await this.medecinsService.setPatientAccess(doctorId, patientId, enabled);

    await this.patientRequestModel.create({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
      requestType: PatientRequestType.ACCESS_CONFIRMATION,
      status: enabled ? PatientRequestStatus.ACCEPTED : PatientRequestStatus.DECLINED,
      requestDate: new Date(),
      respondedAt: new Date(),
      respondedByRole: 'PATIENT',
      authorizationEnabled: enabled,
      urgentNote: enabled
        ? 'Autorisation activée manuellement par le patient'
        : 'Autorisation désactivée manuellement par le patient',
    });

    return { enabled };
  }
}
