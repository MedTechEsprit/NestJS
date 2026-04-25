import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type MedicationRequestDocument = MedicationRequest & Document;

@Schema({ _id: false })
export class PointsBreakdown {
  @ApiProperty({ description: 'Points de base' })
  @Prop({ type: Number, default: 0 })
  basePoints: number;

  @ApiProperty({ description: 'Points bonus' })
  @Prop({ type: Number, default: 0 })
  bonusPoints: number;

  @ApiProperty({ description: 'Raison du calcul' })
  @Prop({ type: String })
  reason: string;
}

@Schema({ _id: false })
export class PharmacyResponse {
  @ApiProperty({ description: 'ID de la pharmacie' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  pharmacyId: Types.ObjectId;

  @ApiProperty({ description: 'Statut de la réponse', enum: ['pending', 'accepted', 'unavailable', 'declined', 'expired', 'ignored'] })
  @Prop({ type: String, enum: ['pending', 'accepted', 'unavailable', 'declined', 'expired', 'ignored'], default: 'pending' })
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

  @ApiProperty({ description: 'Points gagnés par cette réponse' })
  @Prop({ default: 0 })
  pointsAwarded?: number;

  @ApiProperty({ description: 'Détail du calcul des points' })
  @Prop({ type: Object })
  pointsBreakdown?: PointsBreakdown;

  @ApiProperty({ description: 'Distance patient-pharmacie en km' })
  @Prop({ type: Number })
  distanceKm?: number;

  @ApiProperty({ description: 'Nom de la pharmacie (snapshot)' })
  @Prop({ type: String })
  pharmacyName?: string;

  @ApiProperty({ description: 'Adresse de la pharmacie (snapshot)' })
  @Prop({ type: String })
  pharmacyAddress?: string;

  @ApiProperty({ description: 'Coordonnées de la pharmacie [lng, lat] (snapshot)' })
  @Prop({ type: [Number] })
  pharmacyCoordinates?: [number, number];
}

export const PointsBreakdownSchema = SchemaFactory.createForClass(PointsBreakdown);
export const PharmacyResponseSchema = SchemaFactory.createForClass(PharmacyResponse);

@Schema({ timestamps: true })
export class MedicationRequest {
  @ApiProperty({ description: 'ID du patient (optionnel pour l\'instant)' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  patientId?: Types.ObjectId;

  @ApiProperty({ description: 'Nom du médicament', example: 'Insuline Rapide' })
  @Prop({ required: true })
  medicationName: string;

  @ApiProperty({ description: 'ID du médicament (optionnel)' })
  @Prop({ type: String })
  medicationId?: string;

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

  @ApiProperty({ description: 'Localisation du patient (GeoJSON Point)' })
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  })
  patientLocation?: {
    type: string;
    coordinates: [number, number];
  };

  @ApiProperty({ description: 'Rayon utilisé (km) pour sélectionner les pharmacies proches' })
  @Prop({ type: Number })
  requestRadiusKm?: number;
}

export const MedicationRequestSchema = SchemaFactory.createForClass(MedicationRequest);

// Index pour optimiser les requêtes
MedicationRequestSchema.index({ 'pharmacyResponses.pharmacyId': 1 });
MedicationRequestSchema.index({ expiresAt: 1 });
MedicationRequestSchema.index({ globalStatus: 1 });
MedicationRequestSchema.index({ createdAt: -1 });
MedicationRequestSchema.index({ patientLocation: '2dsphere' }, { sparse: true });
