import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Pharmacien, PharmacienDocument } from './schemas/pharmacien.schema';
import { CreatePharmacienDto } from './dto/create-pharmacien.dto';
import { UpdatePharmacienDto } from './dto/update-pharmacien.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

@Injectable()
export class PharmaciensService {
  constructor(
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  private async getOrderStats(pharmacyId: string): Promise<{
    totalOrders: number;
    acceptedOrders: number;
    declinedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalClients: number;
  }> {
    const pid = new Types.ObjectId(pharmacyId);

    const [
      totalOrders,
      acceptedOrders,
      declinedOrders,
      pendingOrders,
      revenueAgg,
      clientIds,
    ] = await Promise.all([
      this.orderModel.countDocuments({ pharmacistId: pid }),
      this.orderModel.countDocuments({
        pharmacistId: pid,
        status: { $in: ['confirmed', 'ready', 'picked_up'] },
      }),
      this.orderModel.countDocuments({ pharmacistId: pid, status: 'cancelled' }),
      this.orderModel.countDocuments({ pharmacistId: pid, status: 'pending' }),
      this.orderModel.aggregate([
        { $match: { pharmacistId: pid, status: 'picked_up' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      this.orderModel.distinct('patientId', {
        pharmacistId: pid,
        status: 'picked_up',
      }),
    ]);

    return {
      totalOrders,
      acceptedOrders,
      declinedOrders,
      pendingOrders,
      totalRevenue: revenueAgg[0]?.total || 0,
      totalClients: clientIds.length,
    };
  }

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

    const updateData: any = { ...updatePharmacienDto };

    // Keep location fields normalized regardless of source (auto-detect or map picker).
    if (
      updateData.latitude != null &&
      updateData.longitude != null &&
      Number.isFinite(updateData.latitude) &&
      Number.isFinite(updateData.longitude)
    ) {
      updateData.location = {
        type: 'Point',
        coordinates: [Number(updateData.longitude), Number(updateData.latitude)],
      };
    }

    if (
      updateData.location &&
      Array.isArray(updateData.location.coordinates) &&
      updateData.location.coordinates.length >= 2
    ) {
      const lng = Number(updateData.location.coordinates[0]);
      const lat = Number(updateData.location.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        updateData.latitude = lat;
        updateData.longitude = lng;
        updateData.location = {
          type: 'Point',
          coordinates: [lng, lat],
        };
      }
    }

    const updatedPharmacien = await this.pharmacienModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-motDePasse')
      .exec();

    if (!updatedPharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    // Keep a single canonical location field.
    await this.pharmacienModel
      .updateOne({ _id: id }, { $unset: { pharmacyLocation: '' } })
      .exec();

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
    const orderStats = await this.getOrderStats(id);

    const acceptanceRate =
      orderStats.totalOrders > 0
        ? Math.round((orderStats.acceptedOrders / orderStats.totalOrders) * 100)
        : 0;

    const responseRate =
      orderStats.totalOrders > 0
        ? Math.round(
            ((orderStats.acceptedOrders + orderStats.declinedOrders) /
              orderStats.totalOrders) *
              100,
          )
        : 0;

    return {
      totalRequestsReceived: orderStats.totalOrders,
      totalRequestsAccepted: orderStats.acceptedOrders,
      totalRequestsDeclined: orderStats.declinedOrders,
      totalClients: orderStats.totalClients || pharmacienObj.totalClients || 0,
      totalRevenue: orderStats.totalRevenue || pharmacienObj.totalRevenue || 0,
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
    const orderStats = await this.getOrderStats(id);

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
      pendingRequestsCount: orderStats.pendingOrders,
      recentActivity: [], // À charger depuis Activities
      recentReviews: [], // À charger depuis Reviews
      badgeProgression,
      performanceComparison,
      valueProposition,
      annualProjection,
      missedOpportunitiesCount,
    };
  }

  // ============ GAMIFICATION POINTS METHODS ============

  async getPointsStats(id: string): Promise<any> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    // Créer une instance du service de calcul des points si nécessaire
    const pharmacienObj = pharmacien.toObject() as any;
    const currentPoints = pharmacienObj.points || 0;

    // Définir les badges
    const badgeThresholds = [
      {
        badge: 'aucun',
        emoji: '',
        minPoints: 0,
        maxPoints: 49,
        description: 'Pas de badge',
      },
      {
        badge: 'fiable',
        emoji: '⭐',
        minPoints: 50,
        maxPoints: 99,
        description: 'Fiable - Répond régulièrement',
      },
      {
        badge: 'reactif',
        emoji: '🔥',
        minPoints: 100,
        maxPoints: 199,
        description: 'Réactif - Répond très rapidement',
      },
      {
        badge: 'excellence',
        emoji: '👑',
        minPoints: 200,
        maxPoints: Infinity,
        description: 'Excellence - Pharmacie de premier choix',
      },
    ];

    const currentBadge = badgeThresholds.find(
      (b) => currentPoints >= b.minPoints && currentPoints < b.maxPoints,
    ) || badgeThresholds[0];

    // Calculer le ranking
    const betterPharmacies = await this.pharmacienModel
      .countDocuments({ points: { $gt: currentPoints } })
      .exec();

    const totalPharmacies = await this.pharmacienModel.countDocuments().exec();
    const rank = betterPharmacies + 1;
    const percentile = Math.round(((totalPharmacies - betterPharmacies) / totalPharmacies) * 100);

    return {
      currentPoints,
      badge: {
        name: currentBadge.badge,
        emoji: currentBadge.emoji,
        description: currentBadge.description,
      },
      ranking: {
        rank,
        totalPharmacies,
        percentile,
      },
      statistics: {
        totalRequests: pharmacienObj.totalRequestsReceived || 0,
        totalAccepted: pharmacienObj.totalRequestsAccepted || 0,
        totalDeclined: pharmacienObj.totalRequestsDeclined || 0,
        acceptanceRate:
          pharmacienObj.totalRequestsReceived > 0
            ? Math.round(
                (pharmacienObj.totalRequestsAccepted / pharmacienObj.totalRequestsReceived) * 100,
              )
            : 0,
        averageResponseTime: pharmacienObj.averageResponseTime || 0,
        totalClients: pharmacienObj.totalClients || 0,
        averageRating: pharmacienObj.averageRating || 0,
        totalReviews: pharmacienObj.totalReviews || 0,
      },
      unlockedBadges: pharmacienObj.unlockedBadges || [],
      badgeThresholds,
    };
  }

  async getRanking(id: string): Promise<any> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    const currentPoints = (pharmacien as any).points || 0;

    const betterPharmacies = await this.pharmacienModel
      .countDocuments({ points: { $gt: currentPoints } })
      .exec();

    const totalPharmacies = await this.pharmacienModel.countDocuments().exec();
    const rank = betterPharmacies + 1;
    const percentile = Math.round(((totalPharmacies - betterPharmacies) / totalPharmacies) * 100);

    return {
      pharmacyId: id,
      rank,
      totalPharmacies,
      percentile,
      points: currentPoints,
      nomPharmacie: (pharmacien as any).nomPharmacie,
    };
  }

  getAllBadgeThresholds(): any[] {
    return [
      {
        badge: 'aucun',
        emoji: '',
        minPoints: 0,
        maxPoints: 49,
        description: 'Pas de badge',
      },
      {
        badge: 'fiable',
        emoji: '⭐',
        minPoints: 50,
        maxPoints: 99,
        description: 'Fiable - Répond régulièrement',
      },
      {
        badge: 'reactif',
        emoji: '🔥',
        minPoints: 100,
        maxPoints: 199,
        description: 'Réactif - Répond très rapidement',
      },
      {
        badge: 'excellence',
        emoji: '👑',
        minPoints: 200,
        maxPoints: Infinity,
        description: 'Excellence - Pharmacie de premier choix',
      },
    ];
  }

  async getDailyPointsHistory(id: string): Promise<any[]> {
    const pharmacien = await this.pharmacienModel.findById(id).exec();

    if (!pharmacien) {
      throw new NotFoundException('Pharmacien non trouvé');
    }

    // Note: Cette méthode dépend du modèle PharmacyActivity
    // Pour l'instant, on retourne une structure vide
    // Dans une implémentation complète, il faudrait injecter PharmacyActivity
    // et récupérer les activités du jour filtrées par pharmacyId

    return [];
  }

  async findNearby(latitude: number, longitude: number, radius: number = 5): Promise<any[]> {
    const pharmacies = await this.pharmacienModel
      .find({
        statutCompte: StatutCompte.ACTIF,
        role: Role.PHARMACIEN,
      })
      .select('-motDePasse')
      .lean()
      .exec();

    const nearby = pharmacies
      .map((pharmacy: any) => {
        const coords = this.extractNearbyCoordinates(pharmacy);
        if (!coords) {
          return null;
        }

        const distance = this.haversineKm(
          latitude,
          longitude,
          coords[1],
          coords[0],
        );

        if (distance > radius) {
          return null;
        }

        return {
          ...pharmacy,
          _distanceKm: distance,
        };
      })
      .filter((p): p is any => p != null)
      .sort((a, b) => a._distanceKm - b._distanceKm)
      .slice(0, 20);

    return nearby.map((pharmacy: any) => {
      // Calculer la distance
      const distance = Number(pharmacy._distanceKm ?? 0);

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

  private extractNearbyCoordinates(doc: any): [number, number] | undefined {
    if (
      doc?.location?.coordinates &&
      Array.isArray(doc.location.coordinates) &&
      doc.location.coordinates.length >= 2
    ) {
      const lng = Number(doc.location.coordinates[0]);
      const lat = Number(doc.location.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lng, lat];
      }
    }

    if (
      doc?.pharmacyLocation?.coordinates &&
      Array.isArray(doc.pharmacyLocation.coordinates) &&
      doc.pharmacyLocation.coordinates.length >= 2
    ) {
      const lng = Number(doc.pharmacyLocation.coordinates[0]);
      const lat = Number(doc.pharmacyLocation.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lng, lat];
      }
    }

    if (Number.isFinite(doc?.latitude) && Number.isFinite(doc?.longitude)) {
      return [Number(doc.longitude), Number(doc.latitude)];
    }

    return undefined;
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
