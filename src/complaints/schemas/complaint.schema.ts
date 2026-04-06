import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComplaintDocument = Complaint & Document;

export enum ComplaintStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Complaint {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userRole: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ default: 'general', trim: true })
  category: string;

  @Prop({ type: String, enum: ComplaintStatus, default: ComplaintStatus.OPEN, index: true })
  status: ComplaintStatus;

  @Prop({ default: '' })
  adminNote: string;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);

ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ userRole: 1, status: 1 });