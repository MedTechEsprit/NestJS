import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type GlucoseDocument = Glucose & Document;

export enum GlucosePeriod {
  FASTING = 'fasting',
  BEFORE_MEAL = 'before_meal',
  AFTER_MEAL = 'after_meal',
  BEDTIME = 'bedtime',
}

@Schema({ timestamps: true })
export class Glucose {
  @ApiProperty({ description: 'ID du patient' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @ApiProperty({ description: 'Valeur de glycémie en mg/dL' })
  @Prop({ required: true })
  value: number;

  @ApiProperty({ description: 'Date et heure de la mesure' })
  @Prop({ required: true })
  measuredAt: Date;

  @ApiProperty({ enum: GlucosePeriod, description: 'Période de mesure' })
  @Prop({ enum: GlucosePeriod })
  period?: GlucosePeriod;

  @ApiProperty({ description: 'Note optionnelle' })
  @Prop()
  note?: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt?: Date;
}

export const GlucoseSchema = SchemaFactory.createForClass(Glucose);

// Index composé pour requêtes rapides par patient et date
GlucoseSchema.index({ patientId: 1, measuredAt: -1 });
