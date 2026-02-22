import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type PharmacyActivityDocument = PharmacyActivity & Document;

@Schema({ timestamps: true })
export class PharmacyActivity {
  @ApiProperty({ description: 'ID de la pharmacie' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  pharmacyId: Types.ObjectId;

  @ApiProperty({ 
    description: 'Type d\'activité', 
    enum: ['request_received', 'request_accepted', 'request_unavailable', 'request_declined', 'request_ignored', 'client_pickup', 'review_received', 'points_earned', 'badge_unlocked', 'boost_activated'] 
  })
  @Prop({ 
    type: String, 
    enum: ['request_received', 'request_accepted', 'request_unavailable', 'request_declined', 'request_ignored', 'client_pickup', 'review_received', 'points_earned', 'badge_unlocked', 'boost_activated'],
    required: true 
  })
  activityType: string;

  @ApiProperty({ description: 'Description de l\'activité' })
  @Prop()
  description?: string;

  @ApiProperty({ description: 'Montant associé' })
  @Prop()
  amount?: number;

  @ApiProperty({ description: 'Points gagnés' })
  @Prop()
  points?: number;

  @ApiProperty({ description: 'Métadonnées supplémentaires' })
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const PharmacyActivitySchema = SchemaFactory.createForClass(PharmacyActivity);

// Index pour optimiser les requêtes
PharmacyActivitySchema.index({ pharmacyId: 1, createdAt: -1 });
