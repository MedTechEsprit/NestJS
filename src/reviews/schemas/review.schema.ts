import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @ApiProperty({ description: 'ID du patient (optionnel pour l\'instant)' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  patientId?: Types.ObjectId;

  @ApiProperty({ description: 'ID de la pharmacie' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  pharmacyId: Types.ObjectId;

  @ApiProperty({ description: 'ID de la demande de médicament associée' })
  @Prop({ type: Types.ObjectId, ref: 'MedicationRequest' })
  requestId?: Types.ObjectId;

  @ApiProperty({ description: 'Note (1-5)', minimum: 1, maximum: 5 })
  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @ApiProperty({ description: 'Commentaire' })
  @Prop()
  comment?: string;

  @ApiProperty({ description: 'Avis visible publiquement', default: true })
  @Prop({ default: true })
  isVisible: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Index pour optimiser les requêtes
ReviewSchema.index({ pharmacyId: 1, isVisible: 1 });
ReviewSchema.index({ createdAt: -1 });
