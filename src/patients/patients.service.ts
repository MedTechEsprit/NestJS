import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Patient, PatientDocument } from './schemas/patient.schema';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
  ) {}

  async create(createPatientDto: CreatePatientDto): Promise<Partial<Patient>> {
    const { email, motDePasse, ...rest } = createPatientDto;

    // Vérifier si l'email existe déjà
    const existingPatient = await this.patientModel
      .findOne({ email: email.toLowerCase() })
      .exec();

    if (existingPatient) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(motDePasse, saltRounds);

    const newPatient = new this.patientModel({
      ...rest,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      role: Role.PATIENT,
      statutCompte: StatutCompte.ACTIF,
    });

    const savedPatient = await newPatient.save();
    const patientObj = savedPatient.toObject() as Record<string, any>;
    const { motDePasse: _, ...patientResponse } = patientObj;

    return patientResponse as Partial<Patient>;
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Partial<Patient>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const filter = { role: Role.PATIENT };

    const [patients, total] = await Promise.all([
      this.patientModel
        .find(filter)
        .select('-motDePasse')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.patientModel.countDocuments(filter).exec(),
    ]);

    return {
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Partial<Patient>> {
    const patient = await this.patientModel
      .findById(id)
      .select('-motDePasse')
      .exec();

    if (!patient) {
      throw new NotFoundException('Patient non trouvé');
    }

    return patient;
  }

  async update(
    id: string,
    updatePatientDto: UpdatePatientDto,
  ): Promise<Partial<Patient>> {
    const patient = await this.patientModel.findById(id).exec();

    if (!patient) {
      throw new NotFoundException('Patient non trouvé');
    }

    // Hasher le nouveau mot de passe si fourni
    if (updatePatientDto.motDePasse) {
      const saltRounds = 10;
      updatePatientDto.motDePasse = await bcrypt.hash(
        updatePatientDto.motDePasse,
        saltRounds,
      );
    }

    const updatedPatient = await this.patientModel
      .findByIdAndUpdate(id, updatePatientDto, { new: true })
      .select('-motDePasse')
      .exec();

    if (!updatedPatient) {
      throw new NotFoundException('Patient non trouvé');
    }

    return updatedPatient;
  }

  async remove(id: string): Promise<{ message: string }> {
    const patient = await this.patientModel.findById(id).exec();

    if (!patient) {
      throw new NotFoundException('Patient non trouvé');
    }

    await this.patientModel.findByIdAndDelete(id).exec();

    return { message: 'Patient supprimé avec succès' };
  }

  async findByTypeDiabete(
    typeDiabete: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Partial<Patient>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const filter = { role: Role.PATIENT, typeDiabete };

    const [patients, total] = await Promise.all([
      this.patientModel
        .find(filter)
        .select('-motDePasse')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.patientModel.countDocuments(filter).exec(),
    ]);

    return {
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
