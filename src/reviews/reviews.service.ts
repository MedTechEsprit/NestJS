import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
  ) {}

  async create(createDto: CreateReviewDto): Promise<Review> {
    const review = new this.reviewModel({
      pharmacyId: new Types.ObjectId(createDto.pharmacyId),
      requestId: createDto.requestId ? new Types.ObjectId(createDto.requestId) : undefined,
      rating: createDto.rating,
      comment: createDto.comment,
      isVisible: true,
    });

    const savedReview = await review.save();

    // Recalculer la note moyenne de la pharmacie
    const avgResult = await this.reviewModel.aggregate([
      {
        $match: {
          pharmacyId: new Types.ObjectId(createDto.pharmacyId),
          isVisible: true,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (avgResult.length > 0) {
      const { averageRating, totalReviews } = avgResult[0];
      await this.pharmacienModel.findByIdAndUpdate(createDto.pharmacyId, {
        $set: {
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews,
        },
      });
    }

    // Ajouter des points si note = 5
    if (createDto.rating === 5) {
      await this.pharmacienModel.findByIdAndUpdate(createDto.pharmacyId, {
        $inc: { points: 8 },
      });

      await this.activityModel.create({
        pharmacyId: new Types.ObjectId(createDto.pharmacyId),
        activityType: 'points_earned',
        description: 'Avis 5 étoiles reçu',
        points: 8,
      });
    }

    // Logger l'activité
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(createDto.pharmacyId),
      activityType: 'review_received',
      description: `Nouvel avis ${createDto.rating} étoiles`,
      metadata: {
        reviewId: savedReview._id,
        rating: createDto.rating,
      },
    });

    return savedReview;
  }

  async findByPharmacy(
    pharmacyId: string,
    ratingFilter?: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Review[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const query: any = {
      pharmacyId: new Types.ObjectId(pharmacyId),
      isVisible: true,
    };

    if (ratingFilter) {
      query.rating = ratingFilter;
    }

    const [data, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary(pharmacyId: string): Promise<any> {
    const [avgResult, distribution] = await Promise.all([
      this.reviewModel.aggregate([
        {
          $match: {
            pharmacyId: new Types.ObjectId(pharmacyId),
            isVisible: true,
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
      this.reviewModel.aggregate([
        {
          $match: {
            pharmacyId: new Types.ObjectId(pharmacyId),
            isVisible: true,
          },
        },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    distribution.forEach((item) => {
      ratingDistribution[item._id] = item.count;
    });

    return {
      averageRating: avgResult.length > 0 ? Math.round(avgResult[0].averageRating * 10) / 10 : 0,
      totalReviews: avgResult.length > 0 ? avgResult[0].totalReviews : 0,
      ratingDistribution,
    };
  }

  async deleteReview(id: string): Promise<void> {
    const review = await this.reviewModel.findById(id).exec();

    if (!review) {
      throw new NotFoundException('Avis non trouvé');
    }

    await this.reviewModel.findByIdAndDelete(id).exec();

    // Recalculer les stats de la pharmacie
    await this.recalculateStats(review.pharmacyId.toString());
  }

  private async recalculateStats(pharmacyId: string): Promise<void> {
    const avgResult = await this.reviewModel.aggregate([
      {
        $match: {
          pharmacyId: new Types.ObjectId(pharmacyId),
          isVisible: true,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (avgResult.length > 0) {
      const { averageRating, totalReviews } = avgResult[0];
      await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
        $set: {
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews,
        },
      });
    } else {
      await this.pharmacienModel.findByIdAndUpdate(pharmacyId, {
        $set: {
          averageRating: 0,
          totalReviews: 0,
        },
      });
    }
  }
}
