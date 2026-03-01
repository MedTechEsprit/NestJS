import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationSeverity } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID to send notification to' })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification type' })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Related entity ID' })
  @IsMongoId()
  @IsOptional()
  relatedId?: string;

  @ApiPropertyOptional({ enum: NotificationSeverity, description: 'Notification severity' })
  @IsEnum(NotificationSeverity)
  @IsOptional()
  severity?: NotificationSeverity;
}
