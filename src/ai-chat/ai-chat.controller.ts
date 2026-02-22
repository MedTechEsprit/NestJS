import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Send a message to the AI assistant',
    description:
      'Authenticates the user, fetches their glucose records, forwards the message to the FastAPI AI server, and returns the AI advice.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI response returned successfully',
    schema: {
      example: { ai_response: 'Your glucose levels suggest ...' },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  async chat(
    @CurrentUser() user: UserDocument,
    @Body() body: AiChatDto,
  ): Promise<{ ai_response: string }> {
    return this.aiChatService.chat(String(user._id), body.user_message);
  }
}
