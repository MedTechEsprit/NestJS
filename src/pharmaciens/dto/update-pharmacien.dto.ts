import { ApiPropertyOptional, PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { CreatePharmacienDto } from './create-pharmacien.dto';
import { IsOptional, IsString, IsObject, IsBoolean, IsNumber } from 'class-validator';

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
}

