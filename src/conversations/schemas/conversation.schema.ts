import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  doctorId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  lastMessage: string;

  @Prop({ type: Date, default: Date.now })
  lastMessageTime: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Unique compound index to ensure one conversation per patient-doctor pair
ConversationSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });
