import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(
  OmitType(CreatePatientDto, ['email', 'motDePasse'] as const),
) {
  @ApiPropertyOptional({ description: 'Nouveau mot de passe' })
  motDePasse?: string;
}
