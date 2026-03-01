import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiChatDto {
  @ApiProperty({
    description: 'Message sent by the user to the AI assistant',
    example: 'My glucose has been high lately, what should I do?',
  })
  @IsString()
  @IsNotEmpty({ message: 'user_message must not be empty' })
  @MaxLength(2000)
  user_message: string;
}
