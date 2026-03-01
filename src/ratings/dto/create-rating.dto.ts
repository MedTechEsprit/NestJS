import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNumber, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ description: 'ID du patient', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  patientId: string;

  @ApiProperty({ description: 'ID de la pharmacie évaluée', example: '507f1f77bcf86cd799439012' })
  @IsMongoId()
  pharmacyId: string;

  @ApiProperty({ description: 'ID de la demande de medication liée', example: '507f1f77bcf86cd799439013' })
  @IsMongoId()
  medicationRequestId: string;

  @ApiProperty({ description: 'Note en étoiles (1-5)', example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional({ description: 'Commentaire du patient', example: 'Très bon service, rapide!' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ 
    description: 'Était-ce que le médicament était vraiment disponible?',
    example: true 
  })
  @IsBoolean()
  medicationAvailable: boolean;

  @ApiPropertyOptional({ description: 'Note sur la rapidité (1-5)', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  speedRating?: number;

  @ApiPropertyOptional({ description: 'Note sur la courtoisie (1-5)', example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  courtesynRating?: number;
}

export class RatingResponseDto {
  id: string;
  patientId: string;
  pharmacyId: string;
  medicationRequestId: string;
  stars: number;
  comment?: string;
  medicationAvailable: boolean;
  speedRating?: number;
  courtesynRating?: number;
  pointsAwarded: number;
  penaltyApplied: number;
  createdAt: Date;
  updatedAt: Date;
}
