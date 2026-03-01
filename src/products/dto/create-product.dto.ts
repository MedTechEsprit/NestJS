import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsNumber() @Min(0) price: number;
  @ApiProperty({ enum: ['medicament', 'supplement', 'materiel', 'hygiene', 'autre'] })
  @IsEnum(['medicament', 'supplement', 'materiel', 'hygiene', 'autre']) category: string;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() stock?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() imageUrl?: string;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() requiresPrescription?: boolean;
  @ApiProperty({ required: false }) @IsString() @IsOptional() dosage?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() manufacturer?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() form?: string;
}
