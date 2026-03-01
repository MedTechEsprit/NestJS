import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateMedecinDto {
  // Champs User de base
  @ApiProperty({ example: 'Martin', description: 'Nom du médecin' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  nom: string;

  @ApiProperty({ example: 'Pierre', description: 'Prénom du médecin' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  prenom: string;

  @ApiProperty({ example: 'medecin@example.com', description: 'Email du médecin' })
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

  // Champs spécifiques Médecin
  @ApiProperty({ example: 'Diabétologie', description: 'Spécialité du médecin' })
  @IsString()
  @IsNotEmpty({ message: 'La spécialité est requise' })
  specialite: string;

  @ApiProperty({ example: 'MED-12345', description: 'Numéro d\'ordre des médecins' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro d\'ordre est requis' })
  numeroOrdre: string;

  @ApiPropertyOptional({ example: 10, description: 'Années d\'expérience' })
  @IsOptional()
  @IsNumber()
  anneesExperience?: number;

  @ApiPropertyOptional({ example: 'Clinique du Diabète', description: 'Nom de la clinique' })
  @IsOptional()
  @IsString()
  clinique?: string;

  @ApiPropertyOptional({ example: '123 Rue de la Santé, Paris', description: 'Adresse du cabinet' })
  @IsOptional()
  @IsString()
  adresseCabinet?: string;

  @ApiPropertyOptional({ description: 'Description du médecin' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 50, description: 'Tarif de consultation en €' })
  @IsOptional()
  @IsNumber()
  tarifConsultation?: number;

  @ApiPropertyOptional({ 
    example: { lundi: '9h-17h', mardi: '9h-17h' }, 
    description: 'Disponibilité du médecin' 
  })
  @IsOptional()
  @IsObject()
  disponibilite?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Type d\'abonnement plateforme' })
  @IsOptional()
  @IsString()
  abonnementPlateforme?: string;
}
