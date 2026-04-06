import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export const MEDECIN_BOOST_TYPES = ['boost_7d', 'boost_15d', 'boost_30d'] as const;
export type MedecinBoostType = (typeof MEDECIN_BOOST_TYPES)[number];

export class ActivateMedecinBoostDto {
  @ApiProperty({
    example: 'boost_15d',
    enum: MEDECIN_BOOST_TYPES,
    description: 'Type de boost médecin',
  })
  @IsEnum(MEDECIN_BOOST_TYPES)
  boostType: MedecinBoostType;
}