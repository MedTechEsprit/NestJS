import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CreateMedecinDto } from './create-medecin.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateMedecinDto extends PartialType(
  OmitType(CreateMedecinDto, ['email', 'motDePasse', 'numeroOrdre'] as const),
) {
  @ApiPropertyOptional({ description: 'Nouveau mot de passe' })
  @IsOptional()
  @IsString()
  motDePasse?: string;

  @ApiPropertyOptional({ 
    description: 'Liste des IDs de patients',
    type: [String] 
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listePatients?: string[];
}
