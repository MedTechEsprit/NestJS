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

  // ============ NOUVELLES MÉTHODES BUSINESS ============

  async updateWorkingHours(id: string, workingHours: any): Promise<Partial<Pharmacien>> {
    const pharmacien = await this.pharmacienModel
      .findByIdAndUpdate(id, { $set: { workingHours } }, { new: true })
      .select('-motDePasse')
      .exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    return pharmacien;
  }

  async toggleDuty(id: string): Promise<Partial<Pharmacien> | null> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    const updatedPharmacien = await this.pharmacienModel
      .findByIdAndUpdate(
        id,
        { $set: { isOnDuty: !(pharmacien as any).isOnDuty } },
        { new: true },
      )
      .select('-motDePasse')
      .exec();

    return updatedPharmacien;
  }

  async updateSettings(id: string, settings: any): Promise<Partial<Pharmacien>> {
    const updateData: any = {};

    if (settings.notificationsPush !== undefined) {
      updateData.notificationsPush = settings.notificationsPush;
    }
    if (settings.notificationsEmail !== undefined) {
      updateData.notificationsEmail = settings.notificationsEmail;
    }
    if (settings.notificationsSMS !== undefined) {
      updateData.notificationsSMS = settings.notificationsSMS;
    }
    if (settings.visibilityRadius !== undefined) {
      updateData.visibilityRadius = settings.visibilityRadius;
    }

    const pharmacien = await this.pharmacienModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .select('-motDePasse')
      .exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    return pharmacien;
  }

  async getStats(id: string): Promise<any> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    const pharmacienObj = pharmacien.toObject() as any;

    const acceptanceRate =
      pharmacienObj.totalRequestsReceived > 0
        ? Math.round((pharmacienObj.totalRequestsAccepted / pharmacienObj.totalRequestsReceived) * 100)
        : 0;

    const responseRate =
      pharmacienObj.totalRequestsReceived > 0
        ? Math.round(
            ((pharmacienObj.totalRequestsAccepted + pharmacienObj.totalRequestsDeclined) /
              pharmacienObj.totalRequestsReceived) *
              100,
          )
        : 0;

    return {
      totalRequestsReceived: pharmacienObj.totalRequestsReceived || 0,
      totalRequestsAccepted: pharmacienObj.totalRequestsAccepted || 0,
      totalRequestsDeclined: pharmacienObj.totalRequestsDeclined || 0,
      totalClients: pharmacienObj.totalClients || 0,
      totalRevenue: pharmacienObj.totalRevenue || 0,
      averageResponseTime: pharmacienObj.averageResponseTime || 0,
      averageRating: pharmacienObj.averageRating || 0,
      totalReviews: pharmacienObj.totalReviews || 0,
      acceptanceRate,
      responseRate,
    };
  }

  async getMonthlyStats(id: string): Promise<any[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Agrégation simulée - dans un vrai système, on agrégerait depuis MedicationRequest
    // Pour l'instant, on retourne des données de structure
    const months: any[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: date.toISOString().slice(0, 7),
        requestsCount: 0,
        acceptedCount: 0,
        clientsCount: 0,
        revenue: 0,
      });
    }

    return months.reverse();
  }

  async getDashboard(id: string): Promise<any> {
    const pharmacien = await this.pharmacienModel.findById(id).select('-motDePasse').exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    const pharmacienObj = pharmacien.toObject() as any;

    // Calculer les statistiques
    const stats = await this.getStats(id);
    const monthlyStats = await this.getMonthlyStats(id);

    // Badge progression
    const BADGE_THRESHOLDS = {
      bronze: { min: 0, max: 50 },
      silver: { min: 50, max: 150 },
      gold: { min: 150, max: 300 },
      platinum: { min: 300, max: 500 },
      diamond: { min: 500, max: 1000 },
    };

    const currentBadge = pharmacienObj.badgeLevel || 'bronze';
    const currentPoints = pharmacienObj.points || 0;

    let nextBadgeName = '';
    let pointsToNextLevel = 0;

    if (currentBadge === 'bronze') {
      nextBadgeName = 'silver';
      pointsToNextLevel = 50 - currentPoints;
    } else if (currentBadge === 'silver') {
      nextBadgeName = 'gold';
      pointsToNextLevel = 150 - currentPoints;
    } else if (currentBadge === 'gold') {
      nextBadgeName = 'platinum';
      pointsToNextLevel = 300 - currentPoints;
    } else if (currentBadge === 'platinum') {
      nextBadgeName = 'diamond';
      pointsToNextLevel = 500 - currentPoints;
    } else {
      nextBadgeName = 'max';
      pointsToNextLevel = 0;
    }

    const badgeProgression = {
      currentPoints,
      currentBadge,
      pointsToNextLevel: pointsToNextLevel > 0 ? pointsToNextLevel : 0,
      nextBadgeName,
    };

    // Performance comparison
    const sectorAverageResponseTime = 45;
    const sectorAverageRating = 3.8;

    const performanceComparison = {
      pharmacyAverageResponseTime: pharmacienObj.averageResponseTime || 0,
      sectorAverage: sectorAverageResponseTime,
      pharmacyAverageRating: pharmacienObj.averageRating || 0,
      sectorAverageRating,
      topPercentage: 15, // Valeur simulée
    };

    // Value proposition
    const valueProposition = {
      equivalentAdvertisingCost: {
        targetedAds: 300,
        localSEO: 200,
        analytics: 150,
        totalValue: 650,
      },
      pharmacyPays: 0,
      annualSavings: 7800,
    };

    // Annual projection
    const avgMonthlyClients = pharmacienObj.totalClients > 0 ? pharmacienObj.totalClients : 10;
    const avgMonthlyRevenue = pharmacienObj.totalRevenue > 0 ? pharmacienObj.totalRevenue : 500;

    const annualProjection = {
      estimatedYearlyClients: avgMonthlyClients * 12,
      estimatedYearlyRevenue: avgMonthlyRevenue * 12,
    };

    // Missed opportunities (requêtes expirées sans réponse ce mois)
    const missedOpportunitiesCount = 0; // À implémenter avec une vraie requête

    return {
      pharmacy: pharmacienObj,
      stats,
      monthlyStats,
      pendingRequestsCount: 0, // À calculer depuis MedicationRequest
      recentActivity: [], // À charger depuis Activities
      recentReviews: [], // À charger depuis Reviews
      badgeProgression,
      performanceComparison,
      valueProposition,
      annualProjection,
      missedOpportunitiesCount,
    };
  }

  async findNearby(latitude: number, longitude: number, radius: number = 5): Promise<any[]> {
    const radiusInMeters = radius * 1000;

    const pharmacies = await this.pharmacienModel
      .find({
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusInMeters,
          },
        },
        statutCompte: StatutCompte.ACTIF,
        role: Role.PHARMACIEN,
      })
      .select('-motDePasse')
      .limit(20)
      .lean()
      .exec();

    return pharmacies.map((pharmacy: any) => {
      // Calculer la distance
      let distance = 0;
      if (pharmacy.location && pharmacy.location.coordinates) {
        const [pharmLng, pharmLat] = pharmacy.location.coordinates;
        const R = 6371; // Rayon de la Terre en km
        const dLat = ((pharmLat - latitude) * Math.PI) / 180;
        const dLon = ((pharmLng - longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((latitude * Math.PI) / 180) *
            Math.cos((pharmLat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = R * c;
      }

      return {
        _id: pharmacy._id,
        nomPharmacie: pharmacy.nomPharmacie,
        adressePharmacie: pharmacy.adressePharmacie,
        telephonePharmacie: pharmacy.telephonePharmacie,
        distance: Math.round(distance * 10) / 10,
        badgeLevel: pharmacy.badgeLevel || 'bronze',
        averageRating: pharmacy.averageRating || 0,
        averageResponseTime: pharmacy.averageResponseTime || 0,
        isOnDuty: pharmacy.isOnDuty || false,
        boostType: pharmacy.boostType || 'free',
        workingHours: pharmacy.workingHours,
      };
    });
  }
}
