import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { AppointmentStatus, AppointmentType } from '../schemas/appointment.schema';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({
    description: 'Appointment date and time',
    example: '2026-03-15T14:30:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format' })
  dateTime?: string;

  @ApiPropertyOptional({
    enum: AppointmentType,
    description: 'Appointment type',
    example: 'ONLINE',
  })
  @IsOptional()
  @IsEnum(AppointmentType, { message: 'Invalid appointment type' })
  type?: AppointmentType;

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    description: 'Appointment status',
    example: 'CONFIRMED',
  })
  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'Invalid appointment status' })
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Notes',
    example: 'Patient will bring test results',
  })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}
