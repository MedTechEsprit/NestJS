import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatientRequestType } from '../schemas/patient-request.schema';

export class CreatePatientRequestDto {
  @ApiProperty({ description: 'Doctor ID to request' })
  @IsMongoId()
  @IsNotEmpty()
  doctorId: string;

  @ApiPropertyOptional({ description: 'Urgent note for the request' })
  @IsString()
  @IsOptional()
  urgentNote?: string;

  @ApiPropertyOptional({
    description: 'Type de demande',
    enum: PatientRequestType,
    default: PatientRequestType.PATIENT_LINK,
  })
  @IsString()
  @IsOptional()
  requestType?: PatientRequestType;
}
