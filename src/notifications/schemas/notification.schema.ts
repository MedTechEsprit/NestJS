import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  PATIENT_ALERT = 'patient_alert',
  NEW_REQUEST = 'new_request',
  APPOINTMENT = 'appointment',
  MESSAGE = 'message',
}

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum NotificationUserType {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  PHARMACY = 'pharmacy',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: NotificationUserType,
    required: false,
    index: true,
  })
  userType?: NotificationUserType;

  @Prop({ 
    type: String, 
    enum: NotificationType, 
    required: true 
  })
  type: NotificationType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: String, required: false })
  body?: string;

  @Prop({ type: Object, default: {} })
  data?: Record<string, any>;

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isRead: boolean;

  @Prop({ type: Types.ObjectId })
  relatedId: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: NotificationSeverity, 
    default: NotificationSeverity.INFO 
  })
  severity: NotificationSeverity;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, timestamp: -1 });
