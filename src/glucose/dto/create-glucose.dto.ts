import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { GlucosePeriod, GlucoseUnit } from '../schemas/glucose.schema';

export class CreateGlucoseDto {
  @ApiProperty({ example: 120, description: 'Valeur de glycémie en mg/dL' })
  @IsNumber({}, { message: 'La valeur doit être un nombre' })
  @IsNotEmpty({ message: 'La valeur est requise' })
  @Min(0, { message: 'La valeur doit être positive' })
  value: number;

  @ApiProperty({ description: 'Date et heure de la mesure' })
  @Type(() => Date)
  @IsDate({ message: 'Date invalide' })
  @IsNotEmpty({ message: 'La date de mesure est requise' })
  measuredAt: Date;

  @ApiPropertyOptional({ enum: GlucosePeriod, description: 'Période de mesure' })
  @IsOptional()
  @IsEnum(GlucosePeriod, { message: 'Période invalide' })
  period?: GlucosePeriod;

  @ApiPropertyOptional({ enum: GlucoseUnit, description: 'Unité de mesure (mg/dL ou mmol/L)' })
  @IsOptional()
  @IsEnum(GlucoseUnit, { message: 'Unité invalide (mg/dL ou mmol/L)' })
  unit?: GlucoseUnit;

  @ApiPropertyOptional({ example: 'Avant le petit déjeuner', description: 'Note optionnelle' })
  @IsOptional()
  @IsString()
  note?: string;
}
