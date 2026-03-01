import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type AiDoctorChatDocument = AiDoctorChat & Document;

@Schema({ _id: false })
export class DoctorChatContextSnapshot {
  @ApiProperty() @Prop({ default: 0 }) patientsAnalyzed: number;
  @ApiProperty() @Prop({ default: 0 }) recordsAnalyzed: number;
  @ApiProperty() @Prop({ type: Date, default: null }) dataFrom: Date | null;
  @ApiProperty() @Prop({ type: Date, default: null }) dataTo: Date | null;
}
const DoctorChatContextSnapshotSchema = SchemaFactory.createForClass(
  DoctorChatContextSnapshot,
);

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ai_doctor_chats',
})
export class AiDoctorChat {
  @ApiProperty({ type: String })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @ApiProperty({ type: String, required: false })
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  patientId: Types.ObjectId | null;

  @ApiProperty({
    enum: ['single_patient', 'all_patients', 'comparison', 'urgent_check'],
  })
  @Prop({
    required: true,
    enum: ['single_patient', 'all_patients', 'comparison', 'urgent_check'],
  })
  queryType: string;

  @ApiProperty()
  @Prop({ required: true })
  message: string;

  @ApiProperty()
  @Prop({ default: '' })
  response: string;

  @ApiProperty({ type: DoctorChatContextSnapshot })
  @Prop({ type: DoctorChatContextSnapshotSchema })
  contextSnapshot: DoctorChatContextSnapshot;

  @ApiProperty()
  createdAt?: Date;
}

export const AiDoctorChatSchema = SchemaFactory.createForClass(AiDoctorChat);

AiDoctorChatSchema.index({ doctorId: 1, createdAt: -1 });
AiDoctorChatSchema.index({ doctorId: 1, patientId: 1, createdAt: -1 });
