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

  @Prop()
  stripeCustomerId?: string;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  latestCheckoutSessionId?: string;
}

export const MedecinBoostSubscriptionSchema = SchemaFactory.createForClass(
  MedecinBoostSubscription,
);

MedecinBoostSubscriptionSchema.index({ medecinId: 1, isActive: 1 });
