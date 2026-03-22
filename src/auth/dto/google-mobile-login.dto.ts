import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class GoogleMobileLoginDto {
  @ApiProperty({
    description: 'Google ID token récupéré côté mobile',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token Google est requis' })
  idToken: string;

  @ApiPropertyOptional({
    enum: [Role.PATIENT],
    description:
      'Rôle demandé pour un nouveau compte Google. Seul PATIENT est supporté en création automatique.',
    default: Role.PATIENT,
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Le rôle doit être PATIENT, MEDECIN ou PHARMACIEN' })
  role?: Role;
}
