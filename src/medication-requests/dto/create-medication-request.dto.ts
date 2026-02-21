import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class CreateMedicationRequestDto {
  @ApiProperty({ example: 'Insuline Rapide', description: 'Nom du médicament' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du médicament est requis' })
  medicationName: string;

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

  @ApiProperty({ 
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'], 
    description: 'Liste des IDs des pharmacies ciblées',
    type: [String]
  })
  @IsArray()
  @IsMongoId({ each: true })
  targetPharmacyIds: string[];
}
