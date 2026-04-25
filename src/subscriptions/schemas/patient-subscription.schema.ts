import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PatientSubscriptionDocument = PatientSubscription & Document;

@Schema({ timestamps: true, collection: 'patient_subscriptions' })
export class PatientSubscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ default: 'premium_monthly' })
  planCode: string;

  @Prop({ default: 'Premium Mensuel' })
  planName: string;

  @Prop({ default: 20 })
  amount: number;

  @Prop({ default: 'eur' })
  currency: string;

  @Prop({ default: false, index: true })
  isActive: boolean;

  @Prop({ default: 'inactive' })
  status: string;

  @Prop()
  subscribedAt?: Date;

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

export const PatientSubscriptionSchema = SchemaFactory.createForClass(PatientSubscription);

PatientSubscriptionSchema.index({ patientId: 1, isActive: 1 });
PatientSubscriptionSchema.index({ revenueCatAppUserId: 1 });