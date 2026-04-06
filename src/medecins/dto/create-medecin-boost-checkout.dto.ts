import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MEDECIN_BOOST_TYPES } from './activate-medecin-boost.dto';
import type { MedecinBoostType } from './activate-medecin-boost.dto';

export class CreateMedecinBoostCheckoutDto {
  @ApiProperty({
    example: 'boost_15d',
    enum: MEDECIN_BOOST_TYPES,
    description: 'Type de boost médecin',
  })
  @IsEnum(MEDECIN_BOOST_TYPES)
  boostType: MedecinBoostType;

  @ApiPropertyOptional({ description: 'URL de retour succès (optionnel)' })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({ description: 'URL de retour annulation (optionnel)' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
