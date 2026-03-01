import { IsMongoId, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsMongoId()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Doctor ID', required: false })
  @IsMongoId()
  @IsOptional()
  doctorId?: string;

  @ApiProperty({ description: 'Pharmacist ID', required: false })
  @IsMongoId()
  @IsOptional()
  pharmacistId?: string;

  @ApiProperty({ description: 'Conversation type', enum: ['doctor', 'pharmacist'], required: false })
  @IsEnum(['doctor', 'pharmacist'])
  @IsOptional()
  type?: string;
}
