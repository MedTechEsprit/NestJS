import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type MedicationRequestDocument = MedicationRequest & Document;

@Schema({ _id: false })
export class PharmacyResponse {
  @ApiProperty({ description: 'ID de la pharmacie' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  pharmacyId: Types.ObjectId;

  @ApiProperty({ description: 'Statut de la réponse', enum: ['pending', 'accepted', 'declined', 'expired', 'ignored'] })
  @Prop({ type: String, enum: ['pending', 'accepted', 'declined', 'expired', 'ignored'], default: 'pending' })
  status: string;

  @ApiProperty({ description: 'Temps de réponse en minutes' })
  @Prop()
  responseTime?: number;

  @ApiProperty({ description: 'Prix indicatif proposé' })
  @Prop()
  indicativePrice?: number;

  @ApiProperty({ description: 'Délai de préparation', enum: ['immediate', '30min', '1h', '2h', 'other'] })
  @Prop({ type: String, enum: ['immediate', '30min', '1h', '2h', 'other'] })
  preparationDelay?: string;

  @ApiProperty({ description: 'Message de la pharmacie' })
  @Prop()
  pharmacyMessage?: string;

  @ApiProperty({ description: 'Date limite de retrait' })
  @Prop()
  pickupDeadline?: Date;

  @ApiProperty({ description: 'Date de réponse' })
  @Prop()
  respondedAt?: Date;
}

export const PharmacyResponseSchema = SchemaFactory.createForClass(PharmacyResponse);

@Schema({ timestamps: true })
export class MedicationRequest {
  @ApiProperty({ description: 'ID du patient (optionnel pour l\'instant)' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  patientId?: Types.ObjectId;

  @ApiProperty({ description: 'Nom du médicament', example: 'Insuline Rapide' })
  @Prop({ required: true })
  medicationName: string;

  @ApiProperty({ description: 'Dosage', example: '100 UI/ml' })
  @Prop({ required: true })
  dosage: string;

  @ApiProperty({ description: 'Quantité demandée', example: 2 })
  @Prop({ required: true })
  quantity: number;

  @ApiProperty({ description: 'Format du médicament', example: 'Flacon' })
  @Prop()
  format?: string;

  @ApiProperty({ description: 'Niveau d\'urgence', enum: ['normal', 'urgent'], default: 'normal' })
  @Prop({ type: String, enum: ['normal', 'urgent'], default: 'normal' })
  urgencyLevel: string;

  @ApiProperty({ description: 'Note du patient' })
  @Prop()
  patientNote?: string;

  @ApiProperty({ description: 'Réponses des pharmacies', type: [PharmacyResponse] })
  @Prop({ type: [PharmacyResponseSchema], default: [] })
  pharmacyResponses: PharmacyResponse[];

  @ApiProperty({ description: 'Statut global de la demande', enum: ['open', 'closed', 'confirmed', 'expired'] })
  @Prop({ type: String, enum: ['open', 'closed', 'confirmed', 'expired'], default: 'open' })
  globalStatus: string;

  @ApiProperty({ description: 'ID de la pharmacie sélectionnée' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  selectedPharmacyId?: Types.ObjectId;

  @ApiProperty({ description: 'Médicament retiré', default: false })
  @Prop({ default: false })
  isPickedUp: boolean;

  @ApiProperty({ description: 'Date de retrait' })
  @Prop()
  pickedUpAt?: Date;

  @ApiProperty({ description: 'Date d\'expiration de la demande' })
  @Prop({ required: true })
  expiresAt: Date;
}

export const MedicationRequestSchema = SchemaFactory.createForClass(MedicationRequest);

// Index pour optimiser les requêtes
MedicationRequestSchema.index({ 'pharmacyResponses.pharmacyId': 1 });
MedicationRequestSchema.index({ expiresAt: 1 });
MedicationRequestSchema.index({ globalStatus: 1 });
MedicationRequestSchema.index({ createdAt: -1 });
