import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePharmacienDto {
  // Champs User de base
  @ApiProperty({ example: 'Durand', description: 'Nom du pharmacien' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  nom: string;

  @ApiProperty({ example: 'Sophie', description: 'Prénom du pharmacien' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  prenom: string;

  @ApiProperty({ example: 'pharmacien@example.com', description: 'Email du pharmacien' })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Mot de passe' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse: string;

  @ApiPropertyOptional({ example: '+33612345678', description: 'Numéro de téléphone personnel' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsOptional()
  @IsString()
  photoProfil?: string;

  // Champs spécifiques Pharmacien
  @ApiProperty({ example: 'PHARM-12345', description: 'Numéro d\'ordre des pharmaciens' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro d\'ordre est requis' })
  numeroOrdre: string;

  @ApiProperty({ example: 'Pharmacie du Centre', description: 'Nom de la pharmacie' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la pharmacie est requis' })
  nomPharmacie: string;

  @ApiPropertyOptional({ example: '45 Avenue de la Santé, Lyon', description: 'Adresse de la pharmacie' })
  @IsOptional()
  @IsString()
  adressePharmacie?: string;

  @ApiPropertyOptional({ 
    example: { lundi: '9h-19h', mardi: '9h-19h', samedi: '9h-12h' }, 
    description: 'Horaires d\'ouverture' 
  })
  @IsOptional()
  @IsObject()
  horaires?: Record<string, any>;

  @ApiPropertyOptional({ example: '+33456789012', description: 'Téléphone de la pharmacie' })
  @IsOptional()
  @IsString()
  telephonePharmacie?: string;

  @ApiPropertyOptional({ 
    example: ['Livraison à domicile', 'Vaccination', 'Tests COVID'], 
    description: 'Services proposés',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicesProposes?: string[];

  @ApiPropertyOptional({ 
    example: ['Insuline Lantus', 'Metformine', 'Glucomètre'], 
    description: 'Liste des médicaments disponibles',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listeMedicamentsDisponibles?: string[];
}
