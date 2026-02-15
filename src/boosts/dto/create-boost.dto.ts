import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsEnum,
  IsNumber,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBoostDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID de la pharmacie' })
  @IsMongoId()
  pharmacyId: string;

  @ApiProperty({ 
    example: 'boost_24h', 
    enum: ['boost_24h', 'boost_week', 'boost_month'], 
    description: 'Type de boost' 
  })
  @IsEnum(['boost_24h', 'boost_week', 'boost_month'])
  boostType: string;

  @ApiProperty({ example: 29.99, description: 'Prix du boost' })
  @IsNumber()
  price: number;

  @ApiProperty({ example: '2026-02-15T10:00:00Z', description: 'Date de début du boost' })
  @IsDate()
  @Type(() => Date)
  startsAt: Date;
}
