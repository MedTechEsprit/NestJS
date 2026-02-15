import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFoodItemDto {
  @ApiProperty({ example: 'Pomme', description: 'Nom de l\'aliment' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de l\'aliment est requis' })
  name: string;

  @ApiProperty({ example: 15, description: 'Glucides en grammes' })
  @IsNumber({}, { message: 'Les glucides doivent être un nombre' })
  @IsNotEmpty({ message: 'Les glucides sont requis' })
  @Min(0, { message: 'Les glucides doivent être positifs' })
  carbs: number;

  @ApiPropertyOptional({ example: 5, description: 'Protéines en grammes' })
  @IsOptional()
  @IsNumber({}, { message: 'Les protéines doivent être un nombre' })
  @Min(0, { message: 'Les protéines doivent être positives' })
  protein?: number;

  @ApiPropertyOptional({ example: 2, description: 'Lipides en grammes' })
  @IsOptional()
  @IsNumber({}, { message: 'Les lipides doivent être un nombre' })
  @Min(0, { message: 'Les lipides doivent être positifs' })
  fat?: number;

  @ApiPropertyOptional({ example: 80, description: 'Calories' })
  @IsOptional()
  @IsNumber({}, { message: 'Les calories doivent être un nombre' })
  @Min(0, { message: 'Les calories doivent être positives' })
  calories?: number;
}
