import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PatientRequestDocument = PatientRequest & Document;

export enum PatientRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export enum PatientRequestType {
  PATIENT_LINK = 'patient_link',
  ACCESS_RENEWAL = 'access_renewal',
  ACCESS_CONFIRMATION = 'access_confirmation',
}

@Schema({ timestamps: true })
export class PatientRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  doctorId: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: PatientRequestStatus, 
    default: PatientRequestStatus.PENDING,
    index: true 
  })
  status: PatientRequestStatus;

  @Prop({
    type: String,
    enum: PatientRequestType,
    default: PatientRequestType.PATIENT_LINK,
    index: true,
  })
  requestType: PatientRequestType;

  @Prop({ type: Date, default: Date.now })
  requestDate: Date;

  @Prop({ type: String })
  urgentNote: string;

  @Prop({ type: String })
  declineReason: string;

  @Prop({ type: Date })
  respondedAt: Date;

  @Prop({ type: String })
  respondedByRole: string;

  @Prop({ type: Boolean })
  authorizationEnabled: boolean;
}

export const PatientRequestSchema = SchemaFactory.createForClass(PatientRequest);

// Compound indexes
PatientRequestSchema.index({ doctorId: 1, status: 1 });
PatientRequestSchema.index({ patientId: 1, doctorId: 1 });
PatientRequestSchema.index({ patientId: 1, status: 1, requestType: 1 });
