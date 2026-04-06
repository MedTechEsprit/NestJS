import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ComplaintStatus } from '../schemas/complaint.schema';

export class UpdateComplaintStatusDto {
  @ApiProperty({ enum: ComplaintStatus })
  @IsEnum(ComplaintStatus)
  status: ComplaintStatus;

  @ApiPropertyOptional({ description: 'Note admin' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}