import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type RatingDocument = Rating & Document;

@Schema({ timestamps: true })
export class Rating {
  @ApiProperty({ description: 'ID du patient qui évalue' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @ApiProperty({ description: 'ID de la pharmacie évaluée' })
  @Prop({ type: Types.ObjectId, ref: 'Pharmacien', required: true })
  pharmacyId: Types.ObjectId;

  @ApiProperty({ description: 'ID de la demande de medication liée' })
  @Prop({ type: Types.ObjectId, ref: 'MedicationRequest', required: true })
  medicationRequestId: Types.ObjectId;

  @ApiProperty({ description: 'Nombre d\'étoiles (1-5)', example: 5, minimum: 1, maximum: 5 })
  @Prop({ required: true, min: 1, max: 5 })
  stars: number;

  @ApiProperty({ description: 'Commentaire du patient' })
  @Prop()
  comment?: string;

  @ApiProperty({ description: 'Le médicament était-il vraiment disponible?' })
  @Prop({ default: true })
  medicationAvailable: boolean;

  @ApiProperty({ description: 'Note sur la rapidité du service' })
  @Prop({ type: Number, min: 1, max: 5 })
  speedRating?: number;

  @ApiProperty({ description: 'Note sur la courtoisie du personnel' })
  @Prop({ type: Number, min: 1, max: 5 })
  courtesynRating?: number;

  @ApiProperty({ description: 'Points gagnés/perdus par cette évaluation' })
  @Prop({ default: 0 })
  pointsAwarded: number;

  @ApiProperty({ description: 'Penalty appliquée si médicament non disponible' })
  @Prop({ default: 0 })
  penaltyApplied: number;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

// Indexes
RatingSchema.index({ pharmacyId: 1 });
RatingSchema.index({ patientId: 1 });
RatingSchema.index({ medicationRequestId: 1 });
RatingSchema.index({ createdAt: -1 });
