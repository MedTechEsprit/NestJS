import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeclineRequestDto {
  @ApiProperty({ description: 'Reason for declining the request' })
  @IsString()
  @IsNotEmpty()
  declineReason: string;
}
