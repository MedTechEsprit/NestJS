import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'Dupont', description: 'Nom de l\'utilisateur' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  nom: string;

  @ApiProperty({ example: 'Jean', description: 'Prénom de l\'utilisateur' })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  prenom: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email de l\'utilisateur' })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Mot de passe' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse: string;

  @ApiPropertyOptional({ example: '+33612345678', description: 'Numéro de téléphone' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiProperty({ enum: Role, description: 'Rôle de l\'utilisateur' })
  @IsEnum(Role, { message: 'Le rôle doit être PATIENT, MEDECIN ou PHARMACIEN' })
  @IsNotEmpty({ message: 'Le rôle est requis' })
  role: Role;
}
