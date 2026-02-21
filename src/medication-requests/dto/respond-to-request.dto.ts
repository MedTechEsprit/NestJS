import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDate,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RespondToRequestDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011', 
    description: 'ID de la pharmacie qui répond' 
  })
  @IsString()
  @IsNotEmpty()
  pharmacyId: string;

  @ApiProperty({ 
    example: 'accepted', 
    enum: ['accepted', 'declined', 'ignored'], 
    description: 'Statut de la réponse' 
  })
  @IsEnum(['accepted', 'declined', 'ignored'])
  status: string;

  @ApiPropertyOptional({ example: 45.50, description: 'Prix indicatif proposé' })
  @IsOptional()
  @IsNumber()
  indicativePrice?: number;

  @ApiPropertyOptional({ 
    example: 'immediate', 
    enum: ['immediate', '30min', '1h', '2h', 'other'],
    description: 'Délai de préparation' 
  })
  @IsOptional()
  @IsEnum(['immediate', '30min', '1h', '2h', 'other'])
  preparationDelay?: string;

  @ApiPropertyOptional({ 
    example: 'Médicament disponible, venez le chercher', 
    description: 'Message de la pharmacie' 
  })
  @IsOptional()
  @IsString()
  pharmacyMessage?: string;

  @ApiPropertyOptional({ 
    example: '2026-02-15T18:00:00Z', 
    description: 'Date limite de retrait' 
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  pickupDeadline?: Date;
}
