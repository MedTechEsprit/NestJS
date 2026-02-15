import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MealSource } from '../schemas/meal.schema';

export class CreateMealDto {
  @ApiProperty({ example: 'Breakfast', description: 'Nom du repas (Breakfast, Lunch, Dinner, Snack)' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du repas est requis' })
  name: string;

  @ApiProperty({ description: 'Date et heure du repas' })
  @Type(() => Date)
  @IsDate({ message: 'Date invalide' })
  @IsNotEmpty({ message: 'La date du repas est requise' })
  eatenAt: Date;

  @ApiProperty({ example: 45, description: 'Glucides en grammes' })
  @IsNumber({}, { message: 'Les glucides doivent être un nombre' })
  @IsNotEmpty({ message: 'Les glucides sont requis' })
  @Min(0, { message: 'Les glucides doivent être positifs' })
  carbs: number;

  @ApiPropertyOptional({ example: 20, description: 'Protéines en grammes' })
  @IsOptional()
  @IsNumber({}, { message: 'Les protéines doivent être un nombre' })
  @Min(0, { message: 'Les protéines doivent être positives' })
  protein?: number;

  @ApiPropertyOptional({ example: 10, description: 'Lipides en grammes' })
  @IsOptional()
  @IsNumber({}, { message: 'Les lipides doivent être un nombre' })
  @Min(0, { message: 'Les lipides doivent être positifs' })
  fat?: number;

  @ApiPropertyOptional({ example: 350, description: 'Calories' })
  @IsOptional()
  @IsNumber({}, { message: 'Les calories doivent être un nombre' })
  @Min(0, { message: 'Les calories doivent être positives' })
  calories?: number;

  @ApiPropertyOptional({ example: 'Repas équilibré', description: 'Note optionnelle' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: MealSource, description: 'Source de données', default: MealSource.MANUAL })
  @IsOptional()
  @IsEnum(MealSource, { message: 'Source invalide' })
  source?: MealSource;

  @ApiPropertyOptional({ example: 95, description: 'Niveau de confiance (0-100) pour prédictions IA' })
  @IsOptional()
  @IsNumber({}, { message: 'La confiance doit être un nombre' })
  @Min(0, { message: 'La confiance doit être entre 0 et 100' })
  @Max(100, { message: 'La confiance doit être entre 0 et 100' })
  confidence?: number;
}
