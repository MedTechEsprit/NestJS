import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { StatutCompte } from '../../common/enums/statut-compte.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Dupont', description: 'Nom de l\'utilisateur' })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({ example: 'Jean', description: 'Prénom de l\'utilisateur' })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email de l\'utilisateur' })
  @IsOptional()
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  @ApiPropertyOptional({ example: 'newpassword123', description: 'Nouveau mot de passe' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse?: string;

  @ApiPropertyOptional({ example: '+33612345678', description: 'Numéro de téléphone' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsOptional()
  @IsString()
  photoProfil?: string;

  @ApiPropertyOptional({ enum: StatutCompte, description: 'Statut du compte' })
  @IsOptional()
  @IsEnum(StatutCompte)
  statutCompte?: StatutCompte;
}
