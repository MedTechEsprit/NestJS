import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
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

  @ApiPropertyOptional({ description: 'Latitude du patient', example: 36.8065 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude du patient', example: 10.1815 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Localisation GeoJSON du patient',
    example: { type: 'Point', coordinates: [10.1815, 36.8065] },
  })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}

