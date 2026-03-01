import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseRegisterUserDto } from './base-register-user.dto';
import { TypeDiabete } from '../../common/enums/type-diabete.enum';
import { Sexe } from '../../common/enums/sexe.enum';

export class RegisterPatientDto extends BaseRegisterUserDto {
  // ── Informations de base (inscription) ─────────────────────────
  @ApiPropertyOptional({ description: 'Date de naissance' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateNaissance?: Date;

  @ApiPropertyOptional({ enum: Sexe, description: 'Sexe du patient' })
  @IsOptional()
  @IsEnum(Sexe)
  sexe?: Sexe;

  @ApiPropertyOptional({ enum: TypeDiabete, description: 'Type de diabète' })
  @IsOptional()
  @IsEnum(TypeDiabete)
  typeDiabete?: TypeDiabete;

  @ApiPropertyOptional({ description: 'Groupe sanguin', example: 'A+' })
  @IsOptional()
  @IsString()
  groupeSanguin?: string;
}

