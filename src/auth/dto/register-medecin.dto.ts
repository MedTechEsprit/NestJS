import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BaseRegisterUserDto } from './base-register-user.dto';

export class RegisterMedecinDto extends BaseRegisterUserDto {
  @ApiProperty({ description: 'Spécialité du médecin', example: 'Endocrinologie' })
  @IsString()
  @IsNotEmpty({ message: 'La spécialité est requise' })
  specialite: string;

  @ApiProperty({ description: 'Numéro d\'ordre des médecins', example: 'MED123456' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro d\'ordre est requis' })
  numeroOrdre: string;

  @ApiPropertyOptional({ description: 'Années d\'expérience', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  anneesExperience?: number;

  @ApiPropertyOptional({ description: 'Nom de la clinique' })
  @IsOptional()
  @IsString()
  clinique?: string;

  @ApiPropertyOptional({ description: 'Adresse du cabinet' })
  @IsOptional()
  @IsString()
  adresseCabinet?: string;

  @ApiPropertyOptional({ description: 'Description du médecin' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tarif de consultation en €', example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifConsultation?: number;

  @ApiPropertyOptional({ 
    description: 'Disponibilité du médecin',
    example: { lundi: ['09:00-12:00', '14:00-18:00'] }
  })
  @IsOptional()
  @IsObject()
  disponibilite?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Type d\'abonnement plateforme' })
  @IsOptional()
  @IsString()
  abonnementPlateforme?: string;
}
