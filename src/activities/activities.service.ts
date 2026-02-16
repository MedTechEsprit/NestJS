import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PharmacyActivity, PharmacyActivityDocument } from './schemas/pharmacy-activity.schema';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
  ) {}

  async log(
    pharmacyId: string,
    activityType: string,
    description?: string,
    amount?: number,
    points?: number,
    metadata?: Record<string, any>,
  ): Promise<PharmacyActivity> {
    const activity = new this.activityModel({
      pharmacyId: new Types.ObjectId(pharmacyId),
      activityType,
      description,
      amount,
      points,
      metadata,
    });

    return activity.save();
  }

  async findByPharmacy(
    pharmacyId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: PharmacyActivity[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.activityModel
        .find({ pharmacyId: new Types.ObjectId(pharmacyId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.activityModel.countDocuments({ pharmacyId: new Types.ObjectId(pharmacyId) }).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFeed(pharmacyId: string): Promise<any[]> {
    const activities = await this.activityModel
      .find({ pharmacyId: new Types.ObjectId(pharmacyId) })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()
      .exec();

    const now = new Date();

    return activities.map((activity: any) => {
      const diffMs = now.getTime() - new Date(activity.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let relativeTime: string;
      if (diffMins < 60) {
        relativeTime = `Il y a ${diffMins} min`;
      } else if (diffHours < 24) {
        relativeTime = `Il y a ${diffHours}h`;
      } else if (diffDays === 1) {
        relativeTime = 'Hier';
      } else {
        relativeTime = `Il y a ${diffDays} jours`;
      }

      return {
        ...activity,
        relativeTime,
      };
    });
  }
}
