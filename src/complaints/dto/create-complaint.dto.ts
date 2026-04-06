import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateComplaintDto {
  @ApiProperty({ description: 'Sujet de la réclamation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject: string;

  @ApiProperty({ description: 'Détail de la réclamation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ description: 'Catégorie', default: 'general' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}