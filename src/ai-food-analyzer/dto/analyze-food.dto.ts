import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class AnalyzeFoodDto {
  @ApiProperty({
    description: 'Image URL of the food to analyze',
    example: 'https://example.com/banana.jpg',
  })
  @IsString()
  @IsNotEmpty({ message: 'image_url must not be empty' })
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url: string;

  @ApiPropertyOptional({
    description: 'Optional message from the user for personalized AI advice',
    example: 'I just ate this, is it good for my glucose?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  user_message?: string;
}
