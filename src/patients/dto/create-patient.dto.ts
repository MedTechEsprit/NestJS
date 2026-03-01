import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';
import { Sexe } from '../../common/enums/sexe.enum';
import { ProfilMedicalDto } from './profil-medical.dto';

export class CreatePatientDto {
  // ── Champs User de base ────────────────────────────────────────
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
  @IsNotEmpty({ message: "L'email est requis" })
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

  // ── Informations de base (inscription) ─────────────────────────
  @ApiPropertyOptional({ description: 'Date de naissance' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateNaissance?: Date;

  @ApiPropertyOptional({ enum: Sexe, description: 'Sexe du patient' })
  @IsOptional()
  @IsEnum(Sexe)
  sexe?: Sexe;

  @ApiPropertyOptional({ enum: TypeDiabete, description: 'Type de diabète' })
  @IsOptional()
  @IsEnum(TypeDiabete)
  typeDiabete?: TypeDiabete;

  @ApiPropertyOptional({ example: 'A+', description: 'Groupe sanguin' })
  @IsOptional()
  @IsString()
  groupeSanguin?: string;

  // ── Sous-document profil médical ───────────────────────────────
  @ApiPropertyOptional({ description: 'Profil médical détaillé', type: ProfilMedicalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfilMedicalDto)
  profilMedical?: ProfilMedicalDto;
}
