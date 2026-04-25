import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { MedicationRequest, MedicationRequestDocument } from './schemas/medication-request.schema';
import { CreateMedicationRequestDto, RespondToRequestDto, CreateSimpleRequestDto } from './dto';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';
import { PointsCalculatorService } from '../common/services/points-calculator.service';
import { FirebaseService } from '../firebase/firebase.service';
import { Role } from '../common/enums/role.enum';
import { StatutCompte } from '../common/enums/statut-compte.enum';

type PharmacyTarget = {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyAddress: string;
  distanceKm: number;
  coordinates?: [number, number];
};

@Injectable()
export class MedicationRequestsService {
  private readonly logger = new Logger(MedicationRequestsService.name);

  constructor(
    @InjectModel(MedicationRequest.name) private requestModel: Model<MedicationRequestDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
    private pointsCalculator: PointsCalculatorService,
    private readonly firebaseService: FirebaseService,
    private readonly configService: ConfigService,
  ) {}

  async create(createDto: CreateMedicationRequestDto): Promise<any> {
    return this.createInternal(createDto);
  }

  async createForPatient(
    patientId: string,
    createDto: CreateMedicationRequestDto,
  ): Promise<any> {
    return this.createInternal(createDto, patientId);
  }

  private async createInternal(
    createDto: CreateMedicationRequestDto,
    patientId?: string,
  ): Promise<any> {
    const medicationLabel =
      createDto.medicationName?.trim() ||
      (createDto.medicationId ? `Medication#${createDto.medicationId}` : 'Demande médicament');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 heures

    const radiusKm =
      createDto.radiusKm && createDto.radiusKm > 0
        ? createDto.radiusKm
        : this.getDefaultRadiusKm();

    // Proximity logic:
    // - If targetPharmacyIds are provided, keep manual mode compatibility.
    // - Otherwise, compute nearby pharmacies from patient coordinates.
    const pharmacyTargets = await this.resolvePharmacyTargets(createDto, radiusKm);

    if (pharmacyTargets.length === 0) {
      throw new BadRequestException(
        'Aucune pharmacie trouvée dans le rayon demandé.',
      );
    }

    // Créer les réponses de pharmacie pour chaque pharmacie ciblée
    const pharmacyResponses = pharmacyTargets.map((target) => ({
      pharmacyId: new Types.ObjectId(target.pharmacyId),
      status: 'pending',
      distanceKm: target.distanceKm,
      pharmacyName: target.pharmacyName,
      pharmacyAddress: target.pharmacyAddress,
      pharmacyCoordinates: target.coordinates,
    }));

    const newRequest = new this.requestModel({
      patientId: patientId ? new Types.ObjectId(patientId) : undefined,
      medicationName: medicationLabel,
      medicationId: createDto.medicationId,
      dosage: createDto.dosage,
      quantity: createDto.quantity,
      format: createDto.format,
      urgencyLevel: createDto.urgencyLevel || 'normal',
      patientNote: createDto.patientNote,
      pharmacyResponses,
      expiresAt,
      globalStatus: 'open',
      requestRadiusKm: radiusKm,
      patientLocation:
        createDto.patientLatitude != null && createDto.patientLongitude != null
          ? {
              type: 'Point',
              coordinates: [createDto.patientLongitude, createDto.patientLatitude],
            }
          : undefined,
    });

    const savedRequest = await newRequest.save();

    const targetPharmacyIds = pharmacyTargets.map((t) => t.pharmacyId);

    // Incrémenter totalRequestsReceived pour chaque pharmacie
    await this.pharmacienModel.updateMany(
      { _id: { $in: targetPharmacyIds.map((id) => new Types.ObjectId(id)) } },
      { $inc: { totalRequestsReceived: 1 } },
    );

    // Créer une activité pour chaque pharmacie
    const activities = targetPharmacyIds.map((pharmacyId) => ({
      pharmacyId: new Types.ObjectId(pharmacyId),
      activityType: 'request_received',
      description: `Nouvelle demande pour ${medicationLabel}`,
      metadata: {
        requestId: savedRequest._id,
        medicationName: medicationLabel,
        urgencyLevel: createDto.urgencyLevel || 'normal',
      },
    }));

    await this.activityModel.insertMany(activities);

    await Promise.all(
      targetPharmacyIds.map((pharmacyId) =>
        // Trigger: notify pharmacy when patient sends a new prescription/medication request.
        this.firebaseService.sendToUser(
          pharmacyId,
          'pharmacy',
          'Nouvelle demande de disponibilité',
          `${medicationLabel} - nouvelle demande patient`,
          {
            requestId: String((savedRequest as any)._id),
            patientId: patientId ? String(patientId) : '',
            pharmacyId: String(pharmacyId),
            medicationName: medicationLabel,
          },
        ),
      ),
    );

    return {
      success: true,
      request: savedRequest,
      contactedPharmacies: pharmacyTargets.map((target) => ({
        pharmacyId: target.pharmacyId,
        pharmacyName: target.pharmacyName,
        pharmacyAddress: target.pharmacyAddress,
        distanceKm: target.distanceKm,
        status: 'pending',
        latitude: target.coordinates?.[1],
        longitude: target.coordinates?.[0],
      })),
      radiusKm,
    };
  }

  private getDefaultRadiusKm(): number {
    const fromEnv = Number(this.configService.get('MAX_PHARMACY_RADIUS_KM') || 15);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 15;
  }

  private async resolvePharmacyTargets(
    createDto: CreateMedicationRequestDto,
    radiusKm: number,
  ): Promise<PharmacyTarget[]> {
    const manualIds = createDto.targetPharmacyIds?.filter(Boolean) || [];
    const lat = createDto.patientLatitude;
    const lng = createDto.patientLongitude;

    if (manualIds.length > 0) {
      const docs = await this.pharmacienModel
        .find({ _id: { $in: manualIds.map((id) => new Types.ObjectId(id)) } })
        .select('_id nomPharmacie adressePharmacie location latitude longitude')
        .lean()
        .exec();

      return docs.map((doc: any) => {
        const coords = this.extractCoordinates(doc);
        const distanceKm =
          lat != null && lng != null && coords
            ? this.haversineKm(lat, lng, coords[1], coords[0])
            : 0;

        return {
          pharmacyId: String(doc._id),
          pharmacyName: doc.nomPharmacie || 'Pharmacie',
          pharmacyAddress: doc.adressePharmacie || '',
          distanceKm: Math.round(distanceKm * 10) / 10,
          coordinates: coords,
        };
      });
    }

    if (lat == null || lng == null) {
      throw new BadRequestException(
        'Les coordonnées patient sont requises pour le mode proximité.',
      );
    }

    return this.findNearbyPharmacies(lat, lng, radiusKm);
  }

  private async findNearbyPharmacies(
    patientLat: number,
    patientLng: number,
    radiusKm: number,
  ): Promise<PharmacyTarget[]> {
    const radiusMeters = radiusKm * 1000;

    const withGeo = await this.pharmacienModel
      .find({
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [patientLng, patientLat],
            },
            $maxDistance: radiusMeters,
          },
        },
        role: Role.PHARMACIEN,
        statutCompte: StatutCompte.ACTIF,
      })
      .select('_id nomPharmacie adressePharmacie location pharmacyLocation latitude longitude')
      .lean()
      .exec();

    const targets: PharmacyTarget[] = withGeo.map((doc: any) => {
      const coords = this.extractCoordinates(doc);
      const distance = coords
        ? this.haversineKm(patientLat, patientLng, coords[1], coords[0])
        : Number.POSITIVE_INFINITY;

      return {
        pharmacyId: String(doc._id),
        pharmacyName: doc.nomPharmacie || 'Pharmacie',
        pharmacyAddress: doc.adressePharmacie || '',
        distanceKm: Math.round(distance * 10) / 10,
        coordinates: coords,
      };
    });

    const legacyWithCoords = await this.pharmacienModel
      .find({
        $or: [{ location: { $exists: false } }, { 'location.coordinates.0': { $exists: false } }],
        'pharmacyLocation.coordinates.0': { $exists: true },
        role: Role.PHARMACIEN,
        statutCompte: StatutCompte.ACTIF,
      })
      .select('_id nomPharmacie adressePharmacie location pharmacyLocation latitude longitude')
      .lean()
      .exec();

    for (const doc of legacyWithCoords as any[]) {
      const coords = this.extractCoordinates(doc);
      if (!coords) {
        continue;
      }

      const distance = this.haversineKm(patientLat, patientLng, coords[1], coords[0]);
      if (distance > radiusKm) {
        continue;
      }

      await this.pharmacienModel
        .updateOne(
          { _id: doc._id },
          {
            $set: {
              location: { type: 'Point', coordinates: coords },
              latitude: coords[1],
              longitude: coords[0],
            },
            $unset: { pharmacyLocation: '' },
          },
        )
        .exec();

      targets.push({
        pharmacyId: String(doc._id),
        pharmacyName: doc.nomPharmacie || 'Pharmacie',
        pharmacyAddress: doc.adressePharmacie || '',
        distanceKm: Math.round(distance * 10) / 10,
        coordinates: coords,
      });
    }

    const noGeoButAddress = await this.pharmacienModel
      .find({
        $or: [{ location: { $exists: false } }, { 'location.coordinates.0': { $exists: false } }],
        'pharmacyLocation.coordinates.0': { $exists: false },
        adressePharmacie: { $exists: true, $ne: '' },
        role: Role.PHARMACIEN,
        statutCompte: StatutCompte.ACTIF,
      })
      .select('_id nomPharmacie adressePharmacie location pharmacyLocation latitude longitude')
      .lean()
      .exec();

    for (const doc of noGeoButAddress as any[]) {
      const geo = await this.geocodeAddress(doc.adressePharmacie);
      if (!geo) {
        continue;
      }

      const coords: [number, number] = [geo.longitude, geo.latitude];
      await this.pharmacienModel
        .updateOne(
          { _id: doc._id },
          {
            $set: {
              location: {
                type: 'Point',
                coordinates: coords,
              },
              latitude: geo.latitude,
              longitude: geo.longitude,
            },
          },
        )
        .exec();

      const distance = this.haversineKm(
        patientLat,
        patientLng,
        geo.latitude,
        geo.longitude,
      );

      if (distance <= radiusKm) {
        targets.push({
          pharmacyId: String(doc._id),
          pharmacyName: doc.nomPharmacie || 'Pharmacie',
          pharmacyAddress: doc.adressePharmacie || '',
          distanceKm: Math.round(distance * 10) / 10,
          coordinates: coords,
        });
      }
    }

    const dedup = new Map<string, PharmacyTarget>();
    for (const target of targets) {
      if (!dedup.has(target.pharmacyId) || target.distanceKm < dedup.get(target.pharmacyId)!.distanceKm) {
        dedup.set(target.pharmacyId, target);
      }
    }

    return [...dedup.values()].sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private extractCoordinates(doc: any): [number, number] | undefined {
    if (doc?.location?.coordinates && Array.isArray(doc.location.coordinates) && doc.location.coordinates.length >= 2) {
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

  private async geocodeAddress(
    address?: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (!address || !address.trim()) {
      return null;
    }

    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY absent: geocoding ignoré');
      return null;
    }

    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address,
            key: apiKey,
          },
          timeout: 7000,
        },
      );

      const payload = response.data;
      if (payload?.status !== 'OK' || !Array.isArray(payload?.results) || payload.results.length === 0) {
        return null;
      }

      const location = payload.results[0]?.geometry?.location;
      if (!location) {
        return null;
      }

      return {
        latitude: Number(location.lat),
        longitude: Number(location.lng),
      };
    } catch (error: any) {
      this.logger.warn(`Geocoding échoué pour adresse [${address}]: ${error?.message || error}`);
      return null;
    }
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
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
      .find({
        patientId: new Types.ObjectId(patientId),
        globalStatus: { $ne: 'closed' },
      })
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

    if ((request as any).patientId) {
      // Trigger: notify patient when pharmacy responds/processes a medication request.
      await this.firebaseService.sendToUser(
        String((request as any).patientId),
        'patient',
        'Mise à jour de votre demande',
        `La pharmacie a répondu: ${respondDto.status}`,
        {
          requestId: String(request._id),
          patientId: String((request as any).patientId),
          pharmacyId: String(pharmacyId),
          status: String(respondDto.status),
        },
      );
    }

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

    // Trigger: notify selected pharmacy when patient confirms pickup selection.
    await this.firebaseService.sendToUser(
      String(selectedPharmacyId),
      'pharmacy',
      'Confirmation de retrait',
      'Le patient a confirmé votre pharmacie pour le retrait.',
      {
        requestId: String((request as any)._id),
        patientId: String((request as any).patientId || ''),
        pharmacyId: String(selectedPharmacyId),
      },
    );

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

    const selectedPharmacyId = (request as any).selectedPharmacyId;
    if (selectedPharmacyId) {
      // Trigger: notify selected pharmacy when patient confirms pickup completion.
      await this.firebaseService.sendToUser(
        String(selectedPharmacyId),
        'pharmacy',
        'Retrait confirmé',
        'Le patient a confirmé le retrait de sa commande.',
        {
          requestId: String((request as any)._id),
          patientId: String((request as any).patientId || ''),
          pharmacyId: String(selectedPharmacyId),
        },
      );
    }

    return request;
  }

  async cancelByPatient(requestId: string, patientId: string): Promise<MedicationRequest> {
    const request = await this.requestModel.findById(requestId).exec();

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (String((request as any).patientId || '') !== String(patientId)) {
      throw new ForbiddenException('Vous ne pouvez annuler que vos propres demandes');
    }

    if ((request as any).isPickedUp) {
      throw new BadRequestException('Cette demande est deja marquee comme retiree');
    }

    if ((request as any).globalStatus === 'closed' || (request as any).globalStatus === 'expired') {
      return request;
    }

    const now = new Date();

    const nextResponses = ((request as any).pharmacyResponses || []).map((response: any) => {
      if (response?.status === 'pending') {
        return {
          ...response,
          status: 'ignored',
          respondedAt: now,
          pharmacyMessage: response?.pharmacyMessage || 'Annulee par le patient',
        };
      }
      return response;
    });

    const updated = await this.requestModel
      .findByIdAndUpdate(
        requestId,
        {
          $set: {
            globalStatus: 'closed',
            expiresAt: now,
            pharmacyResponses: nextResponses,
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Demande non trouvée');
    }

    return updated;
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

    // Trigger: notify pharmacy when patient sends a simple medication request.
    await this.firebaseService.sendToUser(
      String(simpleDto.pharmacyId),
      'pharmacy',
      'Nouvelle ordonnance',
      'Un patient a envoyé une nouvelle demande.',
      {
        requestId: String((request as any)._id),
        patientId: String(simpleDto.patientId),
        pharmacyId: String(simpleDto.pharmacyId),
      },
    );

    return request;
  }
}
