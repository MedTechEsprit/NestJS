import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AppointmentType } from '../schemas/appointment.schema';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Patient ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty({ message: 'Patient ID is required' })
  @IsString()
  patientId: string;

  @ApiProperty({ description: 'Doctor ID', example: '507f1f77bcf86cd799439012' })
  @IsNotEmpty({ message: 'Doctor ID is required' })
  @IsString()
  doctorId: string;

  @ApiProperty({
    description: 'Appointment date and time (ISO 8601)',
    example: '2024-03-15T14:30:00Z',
  })
  @IsNotEmpty({ message: 'Appointment date/time is required' })
  @IsDateString({}, { message: 'Invalid date format' })
  dateTime: string;

  @ApiProperty({ enum: AppointmentType, description: 'Appointment type', example: 'PHYSICAL' })
  @IsNotEmpty({ message: 'Appointment type is required' })
  @IsEnum(AppointmentType, { message: 'Invalid appointment type' })
  type: AppointmentType;

  @ApiProperty({ description: 'Notes (optional)', example: 'Routine checkup' })
  @IsNotEmpty()
  notes?: string;
}
