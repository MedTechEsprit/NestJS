import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export enum RegisterTokenUserType {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  PHARMACY = 'pharmacy',
}

export class RegisterTokenDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ enum: RegisterTokenUserType })
  @IsEnum(RegisterTokenUserType)
  userType: RegisterTokenUserType;

  @ApiProperty({ description: 'Authenticated user ID' })
  @IsMongoId()
  userId: string;
}
