import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiChatDto {
  @ApiProperty({
    description: 'Question sur le diabète ou la nutrition uniquement',
    example: 'Ma glycémie est à 180 mg/dL après mon repas, est-ce normal ?',
    minLength: 2,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(1000)
  message: string;
}
