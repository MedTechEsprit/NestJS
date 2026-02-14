import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Medecin, MedecinDocument } from './schemas/medecin.schema';
import { CreateMedecinDto } from './dto/create-medecin.dto';
import { UpdateMedecinDto } from './dto/update-medecin.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';

@Injectable()
export class MedecinsService {
  constructor(
    @InjectModel(Medecin.name) private medecinModel: Model<MedecinDocument>,
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

    const filter: any = { role: Role.MEDECIN };
    if (specialite) {
      filter.specialite = { $regex: specialite, $options: 'i' };
    }

    const [medecins, total] = await Promise.all([
      this.medecinModel
        .find(filter)
        .select('-motDePasse')
        .populate('listePatients', 'nom prenom email')
        .skip(skip)
        .limit(limit)
        .sort({ noteMoyenne: -1, createdAt: -1 })
        .exec(),
      this.medecinModel.countDocuments(filter).exec(),
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
    const medecin = await this.medecinModel
      .findById(id)
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
    const medecin = await this.medecinModel.findById(id).exec();

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

    const updatedMedecin = await this.medecinModel
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
    const medecin = await this.medecinModel.findById(id).exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    await this.medecinModel.findByIdAndDelete(id).exec();

    return { message: 'Médecin supprimé avec succès' };
  }

  async addPatient(medecinId: string, patientId: string): Promise<Partial<Medecin>> {
    const medecin = await this.medecinModel.findById(medecinId).exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const patientObjectId = new Types.ObjectId(patientId);

    // Vérifier si le patient n'est pas déjà dans la liste
    if (medecin.listePatients.some((p) => p.equals(patientObjectId))) {
      throw new ConflictException('Ce patient est déjà dans la liste');
    }

    medecin.listePatients.push(patientObjectId);
    await medecin.save();

    const updatedMedecin = await this.medecinModel
      .findById(medecinId)
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email')
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin;
  }

  async removePatient(medecinId: string, patientId: string): Promise<Partial<Medecin>> {
    const medecin = await this.medecinModel.findById(medecinId).exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    const patientObjectId = new Types.ObjectId(patientId);
    medecin.listePatients = medecin.listePatients.filter(
      (p) => !p.equals(patientObjectId),
    );
    await medecin.save();

    const updatedMedecin = await this.medecinModel
      .findById(medecinId)
      .select('-motDePasse')
      .populate('listePatients', 'nom prenom email')
      .exec();

    if (!updatedMedecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    return updatedMedecin;
  }

  async updateNote(id: string, note: number): Promise<Partial<Medecin>> {
    const medecin = await this.medecinModel.findById(id).exec();

    if (!medecin) {
      throw new NotFoundException('Médecin non trouvé');
    }

    // Simple moyenne avec la note existante (à améliorer avec un système de reviews)
    medecin.noteMoyenne = (medecin.noteMoyenne + note) / 2;
    await medecin.save();

    const medecinObj = medecin.toObject() as Record<string, any>;
    const { motDePasse: _, ...medecinResponse } = medecinObj;

    return medecinResponse as Partial<Medecin>;
  }
}
