import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';
import { Sexe } from '../../common/enums/sexe.enum';

export class CreatePatientDto {
  // Champs User de base
  @ApiProperty({ example: 'Dupont', description: 'Nom du patient' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  nom: string;

  @ApiProperty({ example: 'Jean', description: 'Prénom du patient' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  prenom: string;

  @ApiProperty({ example: 'patient@example.com', description: 'Email du patient' })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Mot de passe' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse: string;

  @ApiPropertyOptional({ example: '+33612345678', description: 'Numéro de téléphone' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsOptional()
  @IsString()
  photoProfil?: string;

  // Champs spécifiques Patient
  @ApiPropertyOptional({ description: 'Date de naissance' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateNaissance?: Date;

  @ApiPropertyOptional({ enum: Sexe, description: 'Sexe du patient' })
  @IsOptional()
  @IsEnum(Sexe)
  sexe?: Sexe;

  @ApiPropertyOptional({ example: 175, description: 'Taille en cm' })
  @IsOptional()
  @IsNumber()
  taille?: number;

  @ApiPropertyOptional({ example: 70, description: 'Poids en kg' })
  @IsOptional()
  @IsNumber()
  poids?: number;

  @ApiPropertyOptional({ enum: TypeDiabete, description: 'Type de diabète' })
  @IsOptional()
  @IsEnum(TypeDiabete)
  typeDiabete?: TypeDiabete;

  @ApiPropertyOptional({ description: 'Date de diagnostic du diabète' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
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

  @ApiPropertyOptional({ example: 70, description: 'Objectif glycémie minimum (mg/dL)' })
  @IsOptional()
  @IsNumber()
  objectifGlycemieMin?: number;

  @ApiPropertyOptional({ example: 130, description: 'Objectif glycémie maximum (mg/dL)' })
  @IsOptional()
  @IsNumber()
  objectifGlycemieMax?: number;

  @ApiPropertyOptional({ description: 'Traitement actuel' })
  @IsOptional()
  @IsString()
  traitementActuel?: string;

  @ApiPropertyOptional({ description: 'Type d\'insuline utilisé' })
  @IsOptional()
  @IsString()
  typeInsuline?: string;

  @ApiPropertyOptional({ example: 3, description: 'Fréquence d\'injection par jour' })
  @IsOptional()
  @IsNumber()
  frequenceInjection?: number;

  @ApiPropertyOptional({ example: 'Modéré', description: 'Niveau d\'activité physique' })
  @IsOptional()
  @IsString()
  niveauActivitePhysique?: string;
}
