import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiDoctorChatDto {
  @ApiProperty({
    description:
      'Question médicale sur le(s) patient(s) — diabète/nutrition uniquement',
    example: 'Quels patients nécessitent une attention urgente ce mois ?',
    minLength: 2,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(1000)
  message: string;
}
