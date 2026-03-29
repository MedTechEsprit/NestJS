import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicationRequest, MedicationRequestDocument } from './schemas/medication-request.schema';
import { CreateMedicationRequestDto, RespondToRequestDto, CreateSimpleRequestDto } from './dto';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';
import { PointsCalculatorService } from '../common/services/points-calculator.service';

@Injectable()
export class MedicationRequestsService {
  constructor(
    @InjectModel(MedicationRequest.name) private requestModel: Model<MedicationRequestDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
    private pointsCalculator: PointsCalculatorService,
  ) {}

  async create(createDto: CreateMedicationRequestDto): Promise<MedicationRequest> {
    return this.createInternal(createDto);
  }

  async createForPatient(
    patientId: string,
    createDto: CreateMedicationRequestDto,
  ): Promise<MedicationRequest> {
    return this.createInternal(createDto, patientId);
  }

  private async createInternal(
    createDto: CreateMedicationRequestDto,
    patientId?: string,
  ): Promise<MedicationRequest> {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 heures

    // Créer les réponses de pharmacie pour chaque pharmacie ciblée
    const pharmacyResponses = createDto.targetPharmacyIds.map((pharmacyId) => ({
      pharmacyId: new Types.ObjectId(pharmacyId),
      status: 'pending',
    }));

    const newRequest = new this.requestModel({
      patientId: patientId ? new Types.ObjectId(patientId) : undefined,
      medicationName: createDto.medicationName,
      dosage: createDto.dosage,
      quantity: createDto.quantity,
      format: createDto.format,
      urgencyLevel: createDto.urgencyLevel || 'normal',
      patientNote: createDto.patientNote,
      pharmacyResponses,
      expiresAt,
      globalStatus: 'open',
    });

    const savedRequest = await newRequest.save();

    // Incrémenter totalRequestsReceived pour chaque pharmacie
    await this.pharmacienModel.updateMany(
      { _id: { $in: createDto.targetPharmacyIds.map(id => new Types.ObjectId(id)) } },
      { $inc: { totalRequestsReceived: 1 } },
    );

    // Créer une activité pour chaque pharmacie
    const activities = createDto.targetPharmacyIds.map((pharmacyId) => ({
      pharmacyId: new Types.ObjectId(pharmacyId),
      activityType: 'request_received',
      description: `Nouvelle demande pour ${createDto.medicationName}`,
      metadata: {
        requestId: savedRequest._id,
        medicationName: createDto.medicationName,
        urgencyLevel: createDto.urgencyLevel || 'normal',
      },
    }));

    await this.activityModel.insertMany(activities);

    return savedRequest;
  }

  async findByPharmacy(
    pharmacyId: string,
    statusFilter?: string,
  ): Promise<MedicationRequest[]> {
    const query: any = {
      'pharmacyResponses.pharmacyId': new Types.ObjectId(pharmacyId),
    };

    if (statusFilter) {
      query['pharmacyResponses.status'] = statusFilter;
    }

    return this.requestModel
      .find(query)
      .populate('selectedPharmacyId', 'nomPharmacie')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByPatient(patientId: string): Promise<MedicationRequest[]> {
    return this.requestModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('pharmacyResponses.pharmacyId', 'nomPharmacie telephonePharmacie adressePharmacie')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findPending(pharmacyId: string): Promise<MedicationRequest[]> {
    const now = new Date();
    
    return this.requestModel
      .find({
        'pharmacyResponses': {
          $elemMatch: {
            pharmacyId: new Types.ObjectId(pharmacyId),
            status: 'pending',
          },
        },
        expiresAt: { $gt: now },
        globalStatus: 'open',
      })
      .sort({ urgencyLevel: -1, createdAt: -1 })
      .exec();
  }

  async findHistory(
    pharmacyId: string,
    page: number = 1,
    limit: number = 20,
    filters?: any,
  ): Promise<{ data: MedicationRequest[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const query: any = {
      'pharmacyResponses.pharmacyId': new Types.ObjectId(pharmacyId),
    };

    if (filters?.status) {
      query['pharmacyResponses.status'] = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    if (filters?.medicationName) {
      query.medicationName = { $regex: filters.medicationName, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.requestModel
        .find(query)
        .populate('selectedPharmacyId', 'nomPharmacie')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.requestModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<MedicationRequest> {
    const request = await this.requestModel
      .findById(id)
      .populate('selectedPharmacyId', 'nomPharmacie telephonePharmacie adressePharmacie')
      .exec();

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    return request;
  }

  async respondToRequest(
    requestId: string,
    pharmacyId: string,
    respondDto: RespondToRequestDto,
  ): Promise<MedicationRequest> {
    const request = await this.requestModel.findById(requestId).exec();

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (request.globalStatus !== 'open') {
      throw new BadRequestException('Cette demande n\'est plus ouverte');
    }

    const now = new Date();
    if (request.expiresAt < now) {
      throw new BadRequestException('Cette demande a expiré');
    }

    // Calculer le temps de réponse en minutes
    const createdAt = (request as any).createdAt || new Date((request as any)._id.getTimestamp());
    const responseTime = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

    // Calculer les points basés sur le statut
    let pointsBreakdown: any;
    let points = 0;
    let activityDescription = '';
    let activityType = '';

    if (respondDto.status === 'accepted') {
      // "Répondre Disponible"
      pointsBreakdown = this.pointsCalculator.calculateAvailableResponsePoints(responseTime);
      points = pointsBreakdown.totalPoints;
      activityDescription = `Demande acceptée (Disponible): ${request.medicationName} - Réponse en ${responseTime}min`;
      activityType = 'request_accepted';

      // Incrémenter totalRequestsAccepted
      await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
        $inc: { totalRequestsAccepted: 1 },
      });
    } else if (respondDto.status === 'unavailable') {
      // "Répondre Non Disponible"
      pointsBreakdown = this.pointsCalculator.calculateUnavailableResponsePoints();
      points = pointsBreakdown.totalPoints;
      activityDescription = `Demande refusée (Non Disponible): ${request.medicationName}`;
      activityType = 'request_unavailable';

      // Incrémenter totalRequestsDeclined
      await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
        $inc: { totalRequestsDeclined: 1 },
      });
    } else if (respondDto.status === 'declined') {
      // "Rejeter demande"
      pointsBreakdown = this.pointsCalculator.calculateRejectionPoints();
      points = pointsBreakdown.totalPoints;
      activityDescription = `Demande rejetée: ${request.medicationName}`;
      activityType = 'request_declined';

      // Incrémenter totalRequestsDeclined
      await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
        $inc: { totalRequestsDeclined: 1 },
      });
    } else {
      // Ignoré
      pointsBreakdown = { totalPoints: 0, basePoints: 0, bonusPoints: 0, breakdown: ['Demande ignorée'] };
      activityDescription = `Demande ignorée: ${request.medicationName}`;
      activityType = 'request_ignored';
    }

    // Mettre à jour la réponse de la pharmacie spécifique
    const updatedRequest = await this.requestModel.findOneAndUpdate(
      {
        _id: requestId,
        'pharmacyResponses.pharmacyId': new Types.ObjectId(pharmacyId),
      },
      {
        $set: {
          'pharmacyResponses.$[elem].status': respondDto.status,
          'pharmacyResponses.$[elem].responseTime': responseTime,
          'pharmacyResponses.$[elem].respondedAt': now,
          'pharmacyResponses.$[elem].indicativePrice': respondDto.indicativePrice,
          'pharmacyResponses.$[elem].preparationDelay': respondDto.preparationDelay,
          'pharmacyResponses.$[elem].pharmacyMessage': respondDto.pharmacyMessage,
          'pharmacyResponses.$[elem].pickupDeadline': respondDto.pickupDeadline,
          'pharmacyResponses.$[elem].pointsAwarded': points,
          'pharmacyResponses.$[elem].pointsBreakdown': {
            basePoints: pointsBreakdown.basePoints,
            bonusPoints: pointsBreakdown.bonusPoints,
            reason: pointsBreakdown.reason,
          },
        },
      },
      {
        arrayFilters: [{ 'elem.pharmacyId': new Types.ObjectId(pharmacyId) }],
        new: true,
      },
    ).exec();

    if (!updatedRequest) {
      throw new NotFoundException('Pharmacie non trouvée dans cette demande');
    }

    // Appliquer les points à la pharmacie si > 0
    if (points > 0) {
      await this.pointsCalculator.applyPointsToPharmacy(
        pharmacyId,
        pointsBreakdown,
        {
          requestId,
          medicationName: request.medicationName,
          responseTime,
          status: respondDto.status,
        },
      );
    } else if (points < 0) {
      // Appliquer les pénalités
      await this.pointsCalculator.applyPointsToPharmacy(
        pharmacyId,
        pointsBreakdown,
        {
          requestId,
          medicationName: request.medicationName,
          reason: 'Pénalité appliquée',
        },
      );
    }

    // Recalculer les stats
    await this.recalculateStats(pharmacyId);

    // Logger l'activité
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(pharmacyId),
      activityType,
      description: activityDescription,
      points,
      metadata: {
        requestId: request._id,
        medicationName: request.medicationName,
        responseTime,
        pointsBreakdown: pointsBreakdown.breakdown,
      },
    });

    return updatedRequest;
  }

  async confirmRequest(requestId: string, selectedPharmacyId: string): Promise<MedicationRequest | null> {
    const request = await this.requestModel.findById(requestId).exec();

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    const updatedRequest = await this.requestModel.findByIdAndUpdate(
      requestId,
      {
        $set: {
          selectedPharmacyId: new Types.ObjectId(selectedPharmacyId),
          globalStatus: 'confirmed',
        },
      },
      { new: true },
    ).exec();

    // Incrémenter totalClients
    await this.pharmacienModel.findByIdAndUpdate(selectedPharmacyId, {
      $inc: { totalClients: 1 },
    });

    // Logger l'activité
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(selectedPharmacyId),
      activityType: 'client_pickup',
      description: `Client a confirmé le retrait: ${request.medicationName}`,
      points: 0,
      metadata: {
        requestId: request._id,
      },
    });

    return updatedRequest;
  }

  async markAsPickedUp(requestId: string): Promise<MedicationRequest> {
    const request = await this.requestModel.findByIdAndUpdate(
      requestId,
      {
        $set: {
          isPickedUp: true,
          pickedUpAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    return request;
  }

  // Méthode helper privée pour recalculer les stats
  private async recalculateStats(pharmacyId: string): Promise<void> {
    // Recalculer le temps de réponse moyen
    const avgResponseTimeResult = await this.requestModel.aggregate([
      { $unwind: '$pharmacyResponses' },
      {
        $match: {
          'pharmacyResponses.pharmacyId': new Types.ObjectId(pharmacyId),
          'pharmacyResponses.respondedAt': { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          averageResponseTime: { $avg: '$pharmacyResponses.responseTime' },
        },
      },
    ]);

    const averageResponseTime = avgResponseTimeResult.length > 0 
      ? Math.round(avgResponseTimeResult[0].averageResponseTime) 
      : 0;

    await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
      $set: { averageResponseTime },
    });
  }

  // ============ MÉTHODE SIMPLIFIÉE POUR TESTS ============
  async createSimple(simpleDto: CreateSimpleRequestDto): Promise<MedicationRequest> {
    const expirationHeures = simpleDto.expirationHeures || 3;
    const expiresAt = new Date(Date.now() + expirationHeures * 60 * 60 * 1000);

    // Créer la réponse de pharmacie pour la pharmacie ciblée
    const pharmacyResponses = [
      {
        pharmacyId: new Types.ObjectId(simpleDto.pharmacyId),
        status: 'pending',
      },
    ];

    // Créer la demande avec des valeurs par défaut
    const request = await this.requestModel.create({
      patientId: new Types.ObjectId(simpleDto.patientId),
      medicationName: 'Demande personnalisée',
      dosage: 'N/A',
      quantity: 1,
      format: 'N/A',
      urgencyLevel: 'normal',
      patientNote: simpleDto.demandTexte,
      pharmacyResponses,
      globalStatus: 'open',
      expiresAt,
    });

    // Incrémenter le compteur de demandes reçues
    await this.pharmacienModel.findByIdAndUpdate(simpleDto.pharmacyId, {
      $inc: { totalRequestsReceived: 1 },
    });

    // Logger l'activité
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(simpleDto.pharmacyId),
      activityType: 'request_received',
      description: `Nouvelle demande: ${simpleDto.demandTexte.substring(0, 50)}...`,
      metadata: {
        requestId: request._id,
      },
    });

    return request;
  }
}
