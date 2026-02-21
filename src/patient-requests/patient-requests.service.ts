import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PatientRequest, PatientRequestDocument, PatientRequestStatus } from './schemas/patient-request.schema';
import { CreatePatientRequestDto, DeclineRequestDto } from './dto';
import { MedecinsService } from '../medecins/medecins.service';

@Injectable()
export class PatientRequestsService {
  constructor(
    @InjectModel(PatientRequest.name) private patientRequestModel: Model<PatientRequestDocument>,
    private medecinsService: MedecinsService,
  ) {}

  async create(patientId: string, createDto: CreatePatientRequestDto): Promise<PatientRequest> {
    // Check if request already exists
    const existingRequest = await this.patientRequestModel.findOne({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(createDto.doctorId),
      status: PatientRequestStatus.PENDING,
    });

    if (existingRequest) {
      throw new BadRequestException('A pending request to this doctor already exists');
    }

    const request = new this.patientRequestModel({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(createDto.doctorId),
      urgentNote: createDto.urgentNote,
      requestDate: new Date(),
    });

    return request.save();
  }

  async findPendingByDoctor(doctorId: string): Promise<PatientRequest[]> {
    return this.patientRequestModel
      .find({
        doctorId: new Types.ObjectId(doctorId),
        status: PatientRequestStatus.PENDING,
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
    });

    if (!request) {
      throw new NotFoundException('Pending request not found');
    }

    // Update request status
    request.status = PatientRequestStatus.ACCEPTED;
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
    return request.save();
  }

  async findByPatient(patientId: string): Promise<PatientRequest[]> {
    return this.patientRequestModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('doctorId', 'nom prenom email telephone specialite')
      .sort({ requestDate: -1 })
      .exec();
  }
}
