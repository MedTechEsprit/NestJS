import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Pharmacien, PharmacienDocument } from './schemas/pharmacien.schema';
import { CreatePharmacienDto } from './dto/create-pharmacien.dto';
import { UpdatePharmacienDto } from './dto/update-pharmacien.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';

@Injectable()
export class PharmaciensService {
  constructor(
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
  ) {}

  async create(createPharmacienDto: CreatePharmacienDto): Promise<Partial<Pharmacien>> {
    const { email, motDePasse, numeroOrdre, ...rest } = createPharmacienDto;

    // Vérifier si l'email ou le numéro d'ordre existe déjà
    const existingPharmacien = await this.pharmacienModel
      .findOne({ $or: [{ email: email.toLowerCase() }, { numeroOrdre }] })
      .exec();

    if (existingPharmacien) {
      if (existingPharmacien.email === email.toLowerCase()) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw new ConflictException('Ce numéro d\'ordre est déjà utilisé');
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(motDePasse, saltRounds);

    const newPharmacien = new this.pharmacienModel({
      ...rest,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      numeroOrdre,
      role: Role.PHARMACIEN,
      statutCompte: StatutCompte.ACTIF,
      noteMoyenne: 0,
    });

    const savedPharmacien = await newPharmacien.save();
    const pharmacienObj = savedPharmacien.toObject() as Record<string, any>;
    const { motDePasse: _, ...pharmacienResponse } = pharmacienObj;

    return pharmacienResponse as Partial<Pharmacien>;
  }

  async findAll(
    paginationDto: PaginationDto,
    nomPharmacie?: string,
  ): Promise<PaginatedResult<Partial<Pharmacien>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const filter: any = { role: Role.PHARMACIEN };
    if (nomPharmacie) {
      filter.nomPharmacie = { $regex: nomPharmacie, $options: 'i' };
    }

    const [pharmaciens, total] = await Promise.all([
      this.pharmacienModel
        .find(filter)
        .select('-motDePasse')
        .skip(skip)
        .limit(limit)
        .sort({ noteMoyenne: -1, createdAt: -1 })
        .exec(),
      this.pharmacienModel.countDocuments(filter).exec(),
    ]);

    return {
      data: pharmaciens,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Partial<Pharmacien>> {
    const pharmacien = await this.pharmacienModel
      .findById(id)
      .select('-motDePasse')
      .exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    return pharmacien;
  }

  async update(
    id: string,
    updatePharmacienDto: UpdatePharmacienDto,
  ): Promise<Partial<Pharmacien>> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    // Hasher le nouveau mot de passe si fourni
    if (updatePharmacienDto.motDePasse) {
      const saltRounds = 10;
      updatePharmacienDto.motDePasse = await bcrypt.hash(
        updatePharmacienDto.motDePasse,
        saltRounds,
      );
    }

    const updatedPharmacien = await this.pharmacienModel
      .findByIdAndUpdate(id, updatePharmacienDto, { new: true })
      .select('-motDePasse')
      .exec();

    if (!updatedPharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    return updatedPharmacien;
  }

  async remove(id: string): Promise<{ message: string }> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    await this.pharmacienModel.findByIdAndDelete(id).exec();

    return { message: 'Pharmacien supprimé avec succès' };
  }

  async searchByMedicament(
    medicament: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Partial<Pharmacien>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const filter = {
      role: Role.PHARMACIEN,
      listeMedicamentsDisponibles: { $regex: medicament, $options: 'i' },
    };

    const [pharmaciens, total] = await Promise.all([
      this.pharmacienModel
        .find(filter)
        .select('-motDePasse')
        .skip(skip)
        .limit(limit)
        .sort({ noteMoyenne: -1 })
        .exec(),
      this.pharmacienModel.countDocuments(filter).exec(),
    ]);

    return {
      data: pharmaciens,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addMedicament(id: string, medicament: string): Promise<Partial<Pharmacien>> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    if (!pharmacien.listeMedicamentsDisponibles.includes(medicament)) {
      pharmacien.listeMedicamentsDisponibles.push(medicament);
      await pharmacien.save();
    }

    const pharmacienObj = pharmacien.toObject() as Record<string, any>;
    const { motDePasse: _, ...pharmacienResponse } = pharmacienObj;

    return pharmacienResponse as Partial<Pharmacien>;
  }

  async removeMedicament(id: string, medicament: string): Promise<Partial<Pharmacien>> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    pharmacien.listeMedicamentsDisponibles = pharmacien.listeMedicamentsDisponibles.filter(
      (m) => m !== medicament,
    );
    await pharmacien.save();

    const pharmacienObj = pharmacien.toObject() as Record<string, any>;
    const { motDePasse: _, ...pharmacienResponse } = pharmacienObj;

    return pharmacienResponse as Partial<Pharmacien>;
  }

  async updateNote(id: string, note: number): Promise<Partial<Pharmacien>> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    // Simple moyenne avec la note existante
    pharmacien.noteMoyenne = (pharmacien.noteMoyenne + note) / 2;
    await pharmacien.save();

    const pharmacienObj = pharmacien.toObject() as Record<string, any>;
    const { motDePasse: _, ...pharmacienResponse } = pharmacienObj;

    return pharmacienResponse as Partial<Pharmacien>;
  }
}
