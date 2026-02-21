import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseRegisterUserDto } from './base-register-user.dto';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';
import { Sexe } from '../../common/enums/sexe.enum';

export class RegisterPatientDto extends BaseRegisterUserDto {
  // Informations personnelles
  @ApiPropertyOptional({ description: 'Date de naissance' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateNaissance?: Date;

  @ApiPropertyOptional({ enum: Sexe, description: 'Sexe du patient' })
  @IsOptional()
  @IsEnum(Sexe)
  sexe?: Sexe;

  @ApiPropertyOptional({ description: 'Taille en cm', example: 175 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taille?: number;

  @ApiPropertyOptional({ description: 'Poids en kg', example: 70 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  poids?: number;

  @ApiPropertyOptional({ enum: TypeDiabete, description: 'Type de diabète' })
  @IsOptional()
  @IsEnum(TypeDiabete)
  typeDiabete?: TypeDiabete;

  @ApiPropertyOptional({ description: 'Date de diagnostic du diabète' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateDiagnostic?: Date;

  @ApiPropertyOptional({ description: 'Liste des allergies', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({ description: 'Liste des maladies chroniques', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  maladiesChroniques?: string[];

  // Données médicales
  @ApiPropertyOptional({ description: 'Objectif glycémie minimum (mg/dL)', example: 70 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  objectifGlycemieMin?: number;

  @ApiPropertyOptional({ description: 'Objectif glycémie maximum (mg/dL)', example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  objectifGlycemieMax?: number;

  @ApiPropertyOptional({ description: 'Traitement actuel' })
  @IsOptional()
  @IsString()
  traitementActuel?: string;

  @ApiPropertyOptional({ description: 'Type d\'insuline utilisé' })
  @IsOptional()
  @IsString()
  typeInsuline?: string;

  @ApiPropertyOptional({ description: 'Fréquence d\'injection par jour', example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  frequenceInjection?: number;

  @ApiPropertyOptional({ description: 'Niveau d\'activité physique' })
  @IsOptional()
  @IsString()
  niveauActivitePhysique?: string;
}
