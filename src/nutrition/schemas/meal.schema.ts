import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type MealDocument = Meal & Document;

export enum MealSource {
  MANUAL = 'manual',
  AI = 'ai',
}

@Schema({ timestamps: true })
export class Meal {
  @ApiProperty({ description: 'ID du patient' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @ApiProperty({ description: 'Nom du repas (Breakfast, Lunch, Dinner, Snack)' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ description: 'Date et heure du repas' })
  @Prop({ required: true })
  eatenAt: Date;

  @ApiProperty({ description: 'Glucides en grammes' })
  @Prop({ required: true })
  carbs: number;

  @ApiProperty({ description: 'Protéines en grammes' })
  @Prop()
  protein?: number;

  @ApiProperty({ description: 'Lipides en grammes' })
  @Prop()
  fat?: number;

  @ApiProperty({ description: 'Calories' })
  @Prop()
  calories?: number;

  @ApiProperty({ description: 'Note optionnelle' })
  @Prop()
  note?: string;

  @ApiProperty({ enum: MealSource, description: 'Source de données' })
  @Prop({ enum: MealSource, default: MealSource.MANUAL })
  source: MealSource;

  @ApiProperty({ description: 'Niveau de confiance (0-100) pour prédictions IA' })
  @Prop({ min: 0, max: 100 })
  confidence?: number;

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt?: Date;
}

export const MealSchema = SchemaFactory.createForClass(Meal);

// Index composé pour requêtes rapides par patient et date
MealSchema.index({ patientId: 1, eatenAt: -1 });
