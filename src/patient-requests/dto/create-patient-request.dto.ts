import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientRequestDto {
  @ApiProperty({ description: 'Doctor ID to request' })
  @IsMongoId()
  @IsNotEmpty()
  doctorId: string;

  @ApiPropertyOptional({ description: 'Urgent note for the request' })
  @IsString()
  @IsOptional()
  urgentNote?: string;
}
