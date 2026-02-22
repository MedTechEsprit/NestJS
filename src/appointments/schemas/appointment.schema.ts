import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

export enum AppointmentType {
  ONLINE = 'ONLINE',
  PHYSICAL = 'PHYSICAL',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  doctorId: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  dateTime: Date;

  @Prop({ enum: AppointmentType, default: AppointmentType.PHYSICAL })
  type: AppointmentType;

  @Prop({ enum: AppointmentStatus, default: AppointmentStatus.PENDING, index: true })
  status: AppointmentStatus;

  @Prop({ type: String, default: '' })
  notes?: string;

  @Prop({ type: Date, default: null })
  createdAt?: Date;

  @Prop({ type: Date, default: null })
  updatedAt?: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

// Indexes for common queries
AppointmentSchema.index({ patientId: 1, dateTime: -1 });
AppointmentSchema.index({ doctorId: 1, dateTime: -1 });
AppointmentSchema.index({ status: 1, dateTime: -1 });
