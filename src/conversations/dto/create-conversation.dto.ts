import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsMongoId()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Doctor ID' })
  @IsMongoId()
  @IsNotEmpty()
  doctorId: string;
}
