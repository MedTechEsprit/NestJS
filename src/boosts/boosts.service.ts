import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Boost, BoostDocument } from './schemas/boost.schema';
import { CreateBoostDto } from './dto';
import { Pharmacien, PharmacienDocument } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivityDocument } from '../activities/schemas/pharmacy-activity.schema';

@Injectable()
export class BoostsService {
  constructor(
    @InjectModel(Boost.name) private boostModel: Model<BoostDocument>,
    @InjectModel(Pharmacien.name) private pharmacienModel: Model<PharmacienDocument>,
    @InjectModel(PharmacyActivity.name) private activityModel: Model<PharmacyActivityDocument>,
  ) {}

  async activate(createDto: CreateBoostDto): Promise<Boost> {
    const startsAt = new Date(createDto.startsAt);
    let expiresAt: Date;

    // Calculer la date d'expiration selon le type de boost
    switch (createDto.boostType) {
      case 'boost_24h':
        expiresAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000); // 24h
        break;
      case 'boost_week':
        expiresAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 jours
        break;
      case 'boost_month':
        expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 jours
        break;
      default:
        expiresAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
    }

    const boost = new this.boostModel({
      pharmacyId: new Types.ObjectId(createDto.pharmacyId),
      boostType: createDto.boostType,
      price: createDto.price,
      startsAt,
      expiresAt,
      status: 'active',
      paymentStatus: 'paid',
    });

    const savedBoost = await boost.save();

    // Mettre à jour la pharmacie avec les informations du boost
    await this.pharmacienModel.findByIdAndUpdate(createDto.pharmacyId, {
      $set: {
        boostType: createDto.boostType,
        boostExpiresAt: expiresAt,
      },
    });

    // Logger l'activité
    await this.activityModel.create({
      pharmacyId: new Types.ObjectId(createDto.pharmacyId),
      activityType: 'boost_activated',
      description: `Boost ${createDto.boostType} activé`,
      amount: createDto.price,
      metadata: {
        boostId: savedBoost._id,
        expiresAt,
      },
    });

    return savedBoost;
  }

  async findByPharmacy(pharmacyId: string): Promise<Boost[]> {
    return this.boostModel
      .find({ pharmacyId: new Types.ObjectId(pharmacyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActive(pharmacyId: string): Promise<Boost | null> {
    const now = new Date();
    
    return this.boostModel
      .findOne({
        pharmacyId: new Types.ObjectId(pharmacyId),
        status: 'active',
        expiresAt: { $gt: now },
      })
      .exec();
  }

  async cancelBoost(id: string): Promise<Boost | null> {
    const boost = await this.boostModel.findById(id).exec();

    if (!boost) {
      throw new NotFoundException('Boost non trouvé');
    }

    const updatedBoost = await this.boostModel.findByIdAndUpdate(
      id,
      {
        $set: { status: 'cancelled' },
      },
      { new: true },
    ).exec();

    // Réinitialiser le boost de la pharmacie
    await this.pharmacienModel.findByIdAndUpdate(boost.pharmacyId, {
      $set: { boostType: 'free' },
      $unset: { boostExpiresAt: '' },
    });

    return updatedBoost;
  }
}
