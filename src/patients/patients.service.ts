import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Patient, PatientDocument } from './schemas/patient.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

    const filter = { role: { $regex: '^patient$', $options: 'i' } };

    const [patients, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-motDePasse')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
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

  async searchByNameOrEmail(query: string): Promise<Partial<Patient>[]> {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Le paramètre de recherche est requis');
    }

    const searchQuery = query.trim();
    
    // Use userModel to search across all users, filtering by patient role (case-insensitive)
    const patients = await this.userModel
      .find({
        role: { $regex: '^patient$', $options: 'i' },
        $or: [
          { nom: { $regex: searchQuery, $options: 'i' } },
          { prenom: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
        ],
      })
      .select('-motDePasse')
      .limit(20) // Limit results to 20 for performance
      .sort({ nom: 1, prenom: 1 })
      .exec();

    return patients;
  }

  async debugAllRoles(): Promise<any[]> {
    // Get all users from the collection to see what roles exist
    const allUsers = await this.userModel
      .find({})
      .select('nom prenom email role')
      .limit(50)
      .exec();

    return allUsers;
  }

  async findByTypeDiabete(
    typeDiabete: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Partial<Patient>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const filter = { 
      role: { $regex: '^patient$', $options: 'i' },
      typeDiabete 
    };

    const [patients, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-motDePasse')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async canDoctorAccessPatient(doctorId: string, patientId: string): Promise<boolean> {
    const doctor = await this.userModel.collection.findOne({
      _id: new Types.ObjectId(doctorId),
      role: { $regex: '^medecin$', $options: 'i' } as any,
    });

    if (!doctor) {
      return false;
    }

    const linkedPatients = ((doctor as any)?.listePatients || []).map((id: any) => id.toString());
    const isLinked = linkedPatients.includes(patientId);

    if (!isLinked) {
      return false;
    }

    const accessMap = (doctor as any)?.patientAccessMap || {};
    const explicitAccess = accessMap[patientId];

    return explicitAccess == null ? true : Boolean(explicitAccess);
  }
}
