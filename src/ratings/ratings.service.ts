import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rating, RatingDocument } from './schemas/rating.schema';
import { CreateRatingDto } from './dto';
import { PointsCalculatorService } from '../common/services/points-calculator.service';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';
import { MedicationRequest, MedicationRequestDocument } from '../medication-requests/schemas/medication-request.schema';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
    @InjectModel(MedicationRequest.name) private medicationRequestModel: Model<MedicationRequestDocument>,
    private pointsCalculator: PointsCalculatorService,
  ) {}

  async create(createRatingDto: CreateRatingDto): Promise<Rating> {
    if (!createRatingDto.patientId) {
      throw new BadRequestException('Patient manquant');
    }

    // Vérifier que la demande existe
    const medicationRequest = await this.medicationRequestModel
      .findById(createRatingDto.medicationRequestId)
      .exec();

    if (!medicationRequest) {
      throw new NotFoundException('Demande de medication non trouvée');
    }

    if (!medicationRequest.patientId) {
      throw new BadRequestException('Demande non rattachée à un patient');
    }

    if (medicationRequest.patientId.toString() !== createRatingDto.patientId) {
      throw new BadRequestException('Cette demande ne vous appartient pas');
    }

    const isLinkedPharmacy = (medicationRequest.pharmacyResponses || []).some(
      (response) => response.pharmacyId?.toString() === createRatingDto.pharmacyId,
    );

    if (!isLinkedPharmacy) {
      throw new BadRequestException('Pharmacie non liée à cette demande');
    }

    // Vérifier qu'il n'existe pas déjà une note pour cette request
    const existingRating = await this.ratingModel
      .findOne({
        medicationRequestId: new Types.ObjectId(createRatingDto.medicationRequestId),
        patientId: new Types.ObjectId(createRatingDto.patientId),
      })
      .exec();

    if (existingRating) {
      throw new BadRequestException('Une évaluation existe déjà pour cette demande');
    }

    // Calculer les points basés sur les étoiles
    const pointsBreakdown = this.pointsCalculator.calculateRatingPoints(createRatingDto.stars);

    // Appliquer une pénalité si le patient dit que le médicament n'était pas disponible
    let penaltyApplied = 0;
    let totalPointsAwarded = pointsBreakdown.totalPoints;

    if (!createRatingDto.medicationAvailable) {
      const penaltyBreakdown = this.pointsCalculator.calculateAvailabilityPenalty();
      penaltyApplied = Math.abs(penaltyBreakdown.totalPoints);
      totalPointsAwarded = Math.max(0, pointsBreakdown.totalPoints - penaltyApplied);
    }

    // Créer la note
    const rating = new this.ratingModel({
      patientId: new Types.ObjectId(createRatingDto.patientId),
      pharmacyId: new Types.ObjectId(createRatingDto.pharmacyId),
      medicationRequestId: new Types.ObjectId(createRatingDto.medicationRequestId),
      stars: createRatingDto.stars,
      comment: createRatingDto.comment,
      medicationAvailable: createRatingDto.medicationAvailable,
      speedRating: createRatingDto.speedRating,
      courtesynRating: createRatingDto.courtesynRating,
      pointsAwarded: pointsBreakdown.totalPoints,
      penaltyApplied,
    });

    const savedRating = await rating.save();

    // Appliquer les points à la pharmacie
    if (totalPointsAwarded > 0 || penaltyApplied > 0) {
      const pointsToApply = this.pointsCalculator.calculateRatingPoints(createRatingDto.stars);
      
      await this.pointsCalculator.applyPointsToPharmacy(
        createRatingDto.pharmacyId,
        pointsToApply,
        {
          ratingId: savedRating._id,
          stars: createRatingDto.stars,
          medicationAvailable: createRatingDto.medicationAvailable,
          penaltyApplied,
          comment: createRatingDto.comment,
        },
      );
    }

    // Mettre à jour les statistiques de la pharmacie
    await this.updatePharmacyRatingStats(createRatingDto.pharmacyId);

    // Logger l'activité
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(createRatingDto.pharmacyId),
      activityType: 'rating_received',
      description: `Évaluation ${createRatingDto.stars}/5 reçue`,
      points: totalPointsAwarded - penaltyApplied,
      metadata: {
        ratingId: savedRating._id,
        stars: createRatingDto.stars,
        medicationAvailable: createRatingDto.medicationAvailable,
        penaltyApplied,
      },
    });

    return savedRating;
  }

  async findByPharmacy(pharmacyId: string): Promise<Rating[]> {
    return this.ratingModel
      .find({ pharmacyId: new Types.ObjectId(pharmacyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByMedicationRequest(medicationRequestId: string): Promise<Rating | null> {
    return this.ratingModel
      .findOne({ medicationRequestId: new Types.ObjectId(medicationRequestId) })
      .exec();
  }

  async getPharmacyRatingStats(pharmacyId: string): Promise<any> {
    const pharmacy = await this.pharmacienModel.findById(pharmacyId).exec();

    if (!pharmacy) {
      throw new NotFoundException('Pharmacie non trouvée');
    }

    const ratings = await this.ratingModel
      .find({ pharmacyId: new Types.ObjectId(pharmacyId) })
      .exec();

    if (ratings.length === 0) {
      return {
        totalRatings: 0,
        averageRating: 0,
        distribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
        recentRatings: [],
      };
    }

    const distribution: any = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalStars = 0;

    ratings.forEach((rating) => {
      distribution[rating.stars]++;
      totalStars += rating.stars;
    });

    const averageRating = totalStars / ratings.length;

    return {
      totalRatings: ratings.length,
      averageRating: parseFloat(averageRating.toFixed(1)),
      distribution,
      recentRatings: ratings.slice(0, 5),
    };
  }

  private async updatePharmacyRatingStats(pharmacyId: string): Promise<void> {
    const ratings = await this.ratingModel
      .find({ pharmacyId: new Types.ObjectId(pharmacyId) })
      .exec();

    if (ratings.length === 0) {
      return;
    }

    const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
    const averageRating = totalStars / ratings.length;

    await this.pharmacienModel.findByIdAndUpdate(
      pharmacyId,
      {
        $set: {
          averageRating: parseFloat(averageRating.toFixed(1)),
          noteMoyenne: parseFloat(averageRating.toFixed(1)),
          totalReviews: ratings.length,
        },
      },
    ).exec();
  }
}
