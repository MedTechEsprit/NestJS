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

  @Prop()
  stripeCustomerId?: string;

  @Prop()
  stripeSubscriptionId?: string;

  @Prop()
  latestCheckoutSessionId?: string;
}

export const PatientSubscriptionSchema = SchemaFactory.createForClass(PatientSubscription);

PatientSubscriptionSchema.index({ patientId: 1, isActive: 1 });