import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type FoodItemDocument = FoodItem & Document;

@Schema({ timestamps: true })
export class FoodItem {
  @ApiProperty({ description: 'ID du repas' })
  @Prop({ type: Types.ObjectId, ref: 'Meal', required: true })
  mealId: Types.ObjectId;

  @ApiProperty({ description: 'ID du patient' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @ApiProperty({ description: 'Nom de l\'aliment (ex: Pomme, Riz)' })
  @Prop({ required: true })
  name: string;

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

  @ApiProperty({ description: 'Date de création' })
  createdAt?: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt?: Date;
}

export const FoodItemSchema = SchemaFactory.createForClass(FoodItem);

// Index composé pour requêtes rapides par repas et patient
FoodItemSchema.index({ mealId: 1, patientId: 1 });
