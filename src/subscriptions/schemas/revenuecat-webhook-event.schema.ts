import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RevenueCatWebhookEventDocument = RevenueCatWebhookEvent & Document;

@Schema({ timestamps: true, collection: 'revenuecat_webhook_events' })
export class RevenueCatWebhookEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ default: 'revenuecat', index: true })
  provider: string;

  @Prop()
  appUserId?: string;

  @Prop({ type: [String], default: [] })
  relatedAppUserIds: string[];

  @Prop()
  eventTimestampMs?: number;

  @Prop({ default: 'processing', index: true })
  status: string;

  @Prop({ type: Object })
  payload?: Record<string, any>;

  @Prop()
  processedAt?: Date;

  @Prop()
  errorMessage?: string;
}

export const RevenueCatWebhookEventSchema =
  SchemaFactory.createForClass(RevenueCatWebhookEvent);
