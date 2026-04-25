import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MEDECIN_BOOST_TYPES } from '../dto/activate-medecin-boost.dto';
import type { MedecinBoostType } from '../dto/activate-medecin-boost.dto';

export type MedecinBoostSubscriptionDocument = MedecinBoostSubscription & Document;

@Schema({ timestamps: true, collection: 'medecin_boost_subscriptions' })
export class MedecinBoostSubscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  medecinId: Types.ObjectId;

  @Prop({ type: String, enum: MEDECIN_BOOST_TYPES, required: true })
  boostType: MedecinBoostType;

  @Prop({ required: true })
  planName: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'eur' })
  currency: string;

  @Prop({ default: false, index: true })
  isActive: boolean;

  @Prop({ default: 'inactive' })
  status: string;

  @Prop()
  activatedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop()
  lastPaymentAt?: Date;

  @Prop({ default: 'revenuecat' })
  billingProvider: string;

  @Prop({ index: true })
  revenueCatAppUserId?: string;

  @Prop({ index: true })
  revenueCatOriginalAppUserId?: string;

  @Prop()
  revenueCatEntitlementId?: string;

  @Prop()
  revenueCatProductId?: string;

  @Prop()
  latestVerificationId?: string;

  @Prop()
  lastRevenueCatEventTimestampMs?: number;

  @Prop()
  lastSyncedAt?: Date;
}

export const MedecinBoostSubscriptionSchema = SchemaFactory.createForClass(
  MedecinBoostSubscription,
);

MedecinBoostSubscriptionSchema.index({ medecinId: 1, isActive: 1 });
MedecinBoostSubscriptionSchema.index({ revenueCatAppUserId: 1 });
