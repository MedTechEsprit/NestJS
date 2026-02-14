import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CreatePharmacienDto } from './create-pharmacien.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePharmacienDto extends PartialType(
  OmitType(CreatePharmacienDto, ['email', 'motDePasse', 'numeroOrdre'] as const),
) {
  @ApiPropertyOptional({ description: 'Nouveau mot de passe' })
  @IsOptional()
  @IsString()
  motDePasse?: string;
}
