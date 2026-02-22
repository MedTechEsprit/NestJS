import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Medecin, MedecinDocument } from './schemas/medecin.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';
import { GlucoseService } from '../glucose/glucose.service';
import { 
  PatientWithStatusDto, 
  MyPatientsResponseDto, 
  PatientStatus, 
  RiskLevel 
} from './dto/patient-with-status.dto';

@Injectable()
export class MedecinsService {
  constructor(
    @InjectModel(Medecin.name) private medecinModel: Model<MedecinDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private glucoseService: GlucoseService,
  ) {}

  async create(createMedecinDto: CreateMedecinDto): Promise<Partial<Medecin>> {
    const { email, motDePasse, numeroOrdre, ...rest } = createMedecinDto;

    // Vérifier si l'email existe déjà
    const existingMedecin = await this.medecinModel
      .findOne({ $or: [{ email: email.toLowerCase() }, { numeroOrdre }] })
      .exec();

    if (existingMedecin) {
      if (existingMedecin.email === email.toLowerCase()) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw new ConflictException('Ce numéro d\'ordre est déjà utilisé');
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(motDePasse, saltRounds);

    const newMedecin = new this.medecinModel({
      ...rest,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      numeroOrdre,
      role: Role.MEDECIN,
      statutCompte: StatutCompte.ACTIF,
      listePatients: [],
      noteMoyenne: 0,
    });

    const savedMedecin = await newMedecin.save();
    const medecinObj = savedMedecin.toObject() as Record<string, any>;
    const { motDePasse: _, ...medecinResponse } = medecinObj;

    return medecinResponse as Partial<Medecin>;
  }

  async findAll(
    paginationDto: PaginationDto,
    specialite?: string,
  ): Promise<PaginatedResult<Partial<Medecin>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Use userModel with case-insensitive role filter
    const filter: any = { role: { $regex: '^medecin$', $options: 'i' } };
    if (specialite) {
      filter.specialite = { $regex: specialite, $options: 'i' };
    }

    const [medecins, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-motDePasse')
        .populate('listePatients', 'nom prenom email')
        .skip(skip)
        .limit(limit)
        .sort({ noteMoyenne: -1, createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: medecins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Partial<Medecin>> {
    // Use userModel with case-insensitive role filter
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email telephone typeDiabete')
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return medecin;
  }

  async update(
    id: string,
    updateMedecinDto: UpdateMedecinDto,
  ): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Hasher le nouveau mot de passe si fourni
    if (updateMedecinDto.motDePasse) {
      const saltRounds = 10;
      updateMedecinDto.motDePasse = await bcrypt.hash(
        updateMedecinDto.motDePasse,
        saltRounds,
      );
    }

    // Convertir les IDs de patients en ObjectId
    if (updateMedecinDto.listePatients) {
      (updateMedecinDto as any).listePatients = updateMedecinDto.listePatients.map(
        (patientId) => new Types.ObjectId(patientId),
      );
    }

    const updatedMedecin = await this.userModel
      .findByIdAndUpdate(id, updateMedecinDto, { new: true })
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email')
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin;
  }

  async remove(id: string): Promise<{ message: string }> {
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    await this.userModel.findByIdAndDelete(id).exec();

    return { message: 'Médecin supprimé avec succès' };
  }

  async addPatient(medecinId: string, patientId: string): Promise<Partial<Medecin>> {
    // Verify doctor exists
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const patientObjectId = new Types.ObjectId(patientId);

    // Use collection.updateOne directly to bypass schema strict mode
    // This ensures the listePatients field is added even if not in base schema
    const result = await this.userModel.collection.updateOne(
      { _id: new Types.ObjectId(medecinId) },
      { $addToSet: { listePatients: patientObjectId } }
    );

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Return updated doctor
    const updatedMedecin = await this.userModel.findById(medecinId).lean().exec();
    return updatedMedecin as Partial<Medecin>;
  }

  async removePatient(medecinId: string, patientId: string): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: medecinId,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const patientObjectId = new Types.ObjectId(patientId);
    const listePatients = ((medecin as any).listePatients || []).filter(
      (p: Types.ObjectId) => !p.equals(patientObjectId),
    );

    const updatedMedecin = await this.userModel
      .findByIdAndUpdate(
        medecinId,
        { listePatients },
        { new: true }
      )
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email')
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin;
  }

  async updateNote(id: string, note: number): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: id,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Simple moyenne avec la note existante (à améliorer avec un système de reviews)
    const noteMoyenne = ((medecin as any).noteMoyenne + note) / 2;
    await this.userModel.findByIdAndUpdate(id, { noteMoyenne }).exec();

    const medecinObj = medecin.toObject() as Record<string, any>;
    const { motDePasse: _, ...medecinResponse } = medecinObj;

    return medecinResponse as Partial<Medecin>;
  }

  async getMyPatients(
    medecinId: string,
    paginationDto: PaginationDto,
    statusFilter?: string,
    searchQuery?: string,
  ): Promise<MyPatientsResponseDto> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Get the doctor with patient list - explicitly select listePatients field
    const medecin = await this.userModel
      .findOne({
        _id: medecinId,
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('+listePatients')
      .lean()
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const listePatients = (medecin as any).listePatients || [];
    
    if (listePatients.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        statusCounts: { stable: 0, attention: 0, critical: 0 },
      };
    }

    // Build filter for patients
    const patientFilter: any = {
      _id: { $in: listePatients },
      role: { $regex: '^patient$', $options: 'i' },
    };

    // Add search filter if provided
    if (searchQuery && searchQuery.trim() !== '') {
      patientFilter.$or = [
        { nom: { $regex: searchQuery, $options: 'i' } },
        { prenom: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    // Get all matching patients
    const patients = await this.userModel
      .find(patientFilter)
      .select('nom prenom email telephone dateNaissance typeDiabete objectifGlycemieMin objectifGlycemieMax')
      .exec();

    // Enrich patients with health status
    const enrichedPatients = await Promise.all(
      patients.map(async (patient) => {
        const patientObj = patient.toObject() as any;
        
        // Calculate age
        let age: number | undefined;
        if (patientObj.dateNaissance) {
          const birthDate = new Date(patientObj.dateNaissance);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        // Get latest glucose readings (last 7 days)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentReadings = await this.glucoseService.findByDateRange(
          patientObj._id.toString(),
          oneWeekAgo,
          new Date(),
        );

        // Calculate status and get last reading
        const { status, lastReading } = this.calculatePatientStatus(
          recentReadings,
          patientObj.objectifGlycemieMin,
          patientObj.objectifGlycemieMax,
        );

        // Generate initials
        const initials = `${patientObj.prenom?.charAt(0) || ''}${patientObj.nom?.charAt(0) || ''}`.toUpperCase();

        return {
          _id: patientObj._id.toString(),
          prenom: patientObj.prenom,
          nom: patientObj.nom,
          email: patientObj.email,
          telephone: patientObj.telephone,
          dateNaissance: patientObj.dateNaissance,
          age,
          typeDiabete: patientObj.typeDiabete,
          status,
          lastReading,
          initials,
        };
      }),
    );

    // Filter by status if provided
    let filteredPatients = enrichedPatients;
    if (statusFilter && statusFilter !== 'all') {
      filteredPatients = enrichedPatients.filter(
        (p) => p.status === statusFilter,
      );
    }

    // Calculate status counts
    const statusCounts = {
      stable: enrichedPatients.filter((p) => p.status === PatientStatus.STABLE).length,
      attention: enrichedPatients.filter((p) => p.status === PatientStatus.ATTENTION).length,
      critical: enrichedPatients.filter((p) => p.status === PatientStatus.CRITICAL).length,
    };

    // Apply pagination
    const total = filteredPatients.length;
    const paginatedPatients = filteredPatients.slice(skip, skip + limit);

    return {
      data: paginatedPatients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    };
  }

  private calculatePatientStatus(
    readings: any[],
    minTarget?: number,
    maxTarget?: number,
  ): { status: PatientStatus; lastReading?: any } {
    if (!readings || readings.length === 0) {
      return {
        status: PatientStatus.STABLE,
        lastReading: undefined,
      };
    }

    // Get the most recent reading
    const latestReading = readings[0];

    // Default targets if not set (typical ranges)
    const min = minTarget || 70;
    const max = maxTarget || 180;

    // Calculate average of recent readings
    const avgValue = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;

    // Determine risk level for last reading
    let riskLevel: RiskLevel;
    if (latestReading.value < min - 20 || latestReading.value > max + 50) {
      riskLevel = RiskLevel.HIGH;
    } else if (latestReading.value < min || latestReading.value > max) {
      riskLevel = RiskLevel.MEDIUM;
    } else {
      riskLevel = RiskLevel.LOW;
    }

    // Determine overall status
    let status: PatientStatus;
    if (avgValue < min - 20 || avgValue > max + 50) {
      status = PatientStatus.CRITICAL;
    } else if (avgValue < min - 10 || avgValue > max + 30) {
      status = PatientStatus.ATTENTION;
    } else {
      status = PatientStatus.STABLE;
    }

    return {
      status,
      lastReading: {
        value: latestReading.value,
        measuredAt: latestReading.measuredAt,
        riskLevel,
      },
    };
  }

  async toggleAccountStatus(medecinId: string): Promise<Partial<Medecin>> {
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Toggle between ACTIF and INACTIF
    const currentStatus = (medecin as any).statutCompte;
    const newStatus = currentStatus === StatutCompte.ACTIF 
      ? StatutCompte.INACTIF 
      : StatutCompte.ACTIF;

    const updatedMedecin = await this.userModel
      .findByIdAndUpdate(
        medecinId,
        { statutCompte: newStatus },
        { new: true }
      )
      .select('-motDePasse')
      .lean()
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin as Partial<Medecin>;
  }

  async getAccountStatus(medecinId: string): Promise<{ 
    statutCompte: StatutCompte; 
    isActive: boolean;
    _id: string;
    nom: string;
    prenom: string;
    email: string;
  }> {
    const medecin = await this.userModel
      .findOne({
        _id: new Types.ObjectId(medecinId),
        role: { $regex: '^medecin$', $options: 'i' },
      })
      .select('statutCompte nom prenom email')
      .lean()
      .exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const medecinData = medecin as any;
    
    return {
      statutCompte: medecinData.statutCompte,
      isActive: medecinData.statutCompte === StatutCompte.ACTIF,
      _id: medecinData._id.toString(),
      nom: medecinData.nom,
      prenom: medecinData.prenom,
      email: medecinData.email,
    };
  }
}
