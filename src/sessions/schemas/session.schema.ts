import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @ApiProperty({ description: 'ID de l\'utilisateur' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Token JWT unique' })
  @Prop({ required: true, unique: true })
  token: string;

  @ApiProperty({ description: 'Information sur l\'appareil' })
  @Prop()
  deviceInfo?: string;

  @ApiProperty({ description: 'Adresse IP' })
  @Prop()
  ipAddress?: string;

  @ApiProperty({ description: 'User Agent' })
  @Prop()
  userAgent?: string;

  @ApiProperty({ description: 'Date d\'expiration de la session' })
  @Prop({ required: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Si la session est active' })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Date de dernière activité' })
  @Prop({ default: Date.now })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Index for auto-deletion of expired sessions (using existing expiresAt index)
// Note: expiresAt already has index from @Prop, we just add TTL behavior
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Composite index for fast lookups (userId already has index from @Prop)
SessionSchema.index({ userId: 1, isActive: 1 });
