import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type BoostDocument = Boost & Document;

@Schema({ timestamps: true })
export class Boost {
  @ApiProperty({ description: 'ID de la pharmacie' })
  @Prop({ type: Types.ObjectId, ref: 'Pharmacien', required: true })
  pharmacyId: Types.ObjectId;

  @ApiProperty({ description: 'Type de boost', enum: ['boost_24h', 'boost_week', 'boost_month'] })
  @Prop({ type: String, enum: ['boost_24h', 'boost_week', 'boost_month'], required: true })
  boostType: string;

  @ApiProperty({ description: 'Prix du boost' })
  @Prop({ required: true })
  price: number;

  @ApiProperty({ description: 'Date de début du boost' })
  @Prop({ required: true })
  startsAt: Date;

  @ApiProperty({ description: 'Date d\'expiration du boost' })
  @Prop({ required: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Statut du boost', enum: ['active', 'expired', 'cancelled'] })
  @Prop({ type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' })
  status: string;

  @ApiProperty({ description: 'Statut du paiement', enum: ['pending', 'paid', 'failed'] })
  @Prop({ type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' })
  paymentStatus: string;
}

export const BoostSchema = SchemaFactory.createForClass(Boost);

// Index pour optimiser les requêtes
BoostSchema.index({ pharmacyId: 1, status: 1 });
BoostSchema.index({ expiresAt: 1 });
