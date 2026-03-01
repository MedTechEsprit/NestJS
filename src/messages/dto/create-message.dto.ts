import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: 'Sender user ID' })
  @IsMongoId()
  @IsNotEmpty()
  senderId: string;

  @ApiProperty({ description: 'Receiver user ID' })
  @IsMongoId()
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
