import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID de la pharmacie' })
  @IsMongoId()
  pharmacyId: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012', description: 'ID de la demande associée' })
  @IsOptional()
  @IsMongoId()
  requestId?: string;

  @ApiProperty({ example: 5, description: 'Note de 1 à 5', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Excellent service, très professionnel', description: 'Commentaire' })
  @IsOptional()
  @IsString()
  comment?: string;
}
