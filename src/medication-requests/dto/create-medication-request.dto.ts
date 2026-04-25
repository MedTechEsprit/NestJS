import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsMongoId,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicationRequestDto {
  @ApiPropertyOptional({ example: 'Insuline Rapide', description: 'Nom du médicament (requis si medicationId absent)' })
  @ValidateIf((o) => !o.medicationId)
  @IsString()
  @IsNotEmpty({ message: 'Le nom du médicament est requis' })
  medicationName?: string;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'ID du médicament (requis si medicationName absent)',
  })
  @ValidateIf((o) => !o.medicationName)
  @IsMongoId()
  medicationId?: string;

  @ApiProperty({ example: '100 UI/ml', description: 'Dosage du médicament' })
  @IsString()
  @IsNotEmpty({ message: 'Le dosage est requis' })
  dosage: string;

  @ApiProperty({ example: 2, description: 'Quantité demandée' })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ example: 'Flacon', description: 'Format du médicament' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ example: 'normal', enum: ['normal', 'urgent'], description: 'Niveau d\'urgence' })
  @IsOptional()
  @IsEnum(['normal', 'urgent'])
  urgencyLevel?: string;

  @ApiPropertyOptional({ example: 'Besoin urgent pour traitement', description: 'Note du patient' })
  @IsOptional()
  @IsString()
  patientNote?: string;

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'], 
    description: 'Liste des IDs des pharmacies ciblées (mode manuel). Si absent, le backend calcule les pharmacies proches via la géolocalisation.',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  targetPharmacyIds?: string[];

  @ApiPropertyOptional({
    example: 36.8065,
    description: 'Latitude actuelle du patient (requise pour le mode proximité automatique)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  patientLatitude?: number;

  @ApiPropertyOptional({
    example: 10.1815,
    description: 'Longitude actuelle du patient (requise pour le mode proximité automatique)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  patientLongitude?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Rayon maximal en km pour sélectionner les pharmacies proches',
    default: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radiusKm?: number;
}
