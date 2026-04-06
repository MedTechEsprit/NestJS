import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiPropertyOptional({ description: 'URL de retour succès (optionnel)' })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({ description: 'URL de retour annulation (optionnel)' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}