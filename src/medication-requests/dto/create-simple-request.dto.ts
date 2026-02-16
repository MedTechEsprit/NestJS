import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateSimpleRequestDto {
  @ApiProperty({
    example: '69910805fa9cb3ec5e0e95cb',
    description: 'ID du patient qui fait la demande',
  })
  @IsString()
  @IsNotEmpty({ message: 'ID du patient requis' })
  patientId: string;

  @ApiProperty({
    example: '69910805fa9cb3ec5e0e95cd',
    description: 'ID de la pharmacie qui reçoit la demande',
  })
  @IsString()
  @IsNotEmpty({ message: 'ID de la pharmacie requis' })
  pharmacyId: string;

  @ApiProperty({
    example: 'Bonjour, j\'ai besoin de Metformine 850mg, 30 comprimés. Disponible ?',
    description: 'Texte libre de la demande',
  })
  @IsString()
  @IsNotEmpty({ message: 'Texte de la demande requis' })
  demandTexte: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Nombre d\'heures avant expiration (par défaut 3 heures)',
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  expirationHeures?: number;
}
