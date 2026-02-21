import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseRegisterUserDto } from './base-register-user.dto';

export class RegisterPharmacienDto extends BaseRegisterUserDto {
  @ApiProperty({ description: 'Numéro d\'ordre des pharmaciens', example: 'PHAR123456' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro d\'ordre est requis' })
  numeroOrdre: string;

  @ApiProperty({ description: 'Nom de la pharmacie', example: 'Pharmacie Centrale' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la pharmacie est requis' })
  nomPharmacie: string;

  @ApiPropertyOptional({ description: 'Adresse de la pharmacie' })
  @IsOptional()
  @IsString()
  adressePharmacie?: string;

  @ApiPropertyOptional({ 
    description: 'Horaires d\'ouverture',
    example: { lundi: '08:00-19:00', mardi: '08:00-19:00' }
  })
  @IsOptional()
  @IsObject()
  horaires?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Téléphone de la pharmacie' })
  @IsOptional()
  @IsString()
  telephonePharmacie?: string;

  @ApiPropertyOptional({ 
    description: 'Services proposés', 
    type: [String],
    example: ['Conseil en diabétologie', 'Livraison à domicile']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicesProposes?: string[];

  @ApiPropertyOptional({ 
    description: 'Liste des médicaments disponibles', 
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listeMedicamentsDisponibles?: string[];
}
