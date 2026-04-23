import { ApiPropertyOptional, PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { CreatePharmacienDto } from './create-pharmacien.dto';
import { IsOptional, IsString, IsObject, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class UpdatePharmacienDto extends PartialType(
  OmitType(CreatePharmacienDto, ['email', 'motDePasse', 'numeroOrdre'] as const),
) {
  @ApiPropertyOptional({ description: 'Nouveau mot de passe' })
  @IsOptional()
  @IsString()
  motDePasse?: string;

  @ApiPropertyOptional({ description: 'Horaires de travail' })
  @IsOptional()
  @IsObject()
  workingHours?: any;

  @ApiPropertyOptional({ description: 'En service de garde' })
  @IsOptional()
  @IsBoolean()
  isOnDuty?: boolean;

  @ApiPropertyOptional({ description: 'Rayon de visibilité (km)' })
  @IsOptional()
  @IsNumber()
  visibilityRadius?: number;

  @ApiPropertyOptional({ description: 'Notifications push activées' })
  @IsOptional()
  @IsBoolean()
  notificationsPush?: boolean;

  @ApiPropertyOptional({ description: 'Notifications email activées' })
  @IsOptional()
  @IsBoolean()
  notificationsEmail?: boolean;

  @ApiPropertyOptional({ description: 'Notifications SMS activées' })
  @IsOptional()
  @IsBoolean()
  notificationsSMS?: boolean;

  @ApiPropertyOptional({ description: 'Image de profil' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Latitude de la pharmacie', example: 36.8065 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude de la pharmacie', example: 10.1815 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Localisation GeoJSON de la pharmacie',
    example: { type: 'Point', coordinates: [10.1815, 36.8065] },
  })
  @IsOptional()
  @IsObject()
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

