import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards';
import { ConversationsService } from './conversations.service';
import { MessagesService } from '../messages/messages.service';
import { CreateConversationDto } from './dto';
import { CreateMessageDto } from '../messages/dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  create(@Body() createConversationDto: CreateConversationDto) {
    return this.conversationsService.create(createConversationDto);
  }

  @Get('patients/:patientId/conversations')
  @ApiOperation({ summary: 'Get all conversations for a patient with unread count' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.conversationsService.findByPatient(patientId);
  }

  @Get('doctors/:doctorId/conversations')
  @ApiOperation({ summary: 'Get all conversations for a doctor with unread count' })
  findByDoctor(@Param('doctorId') doctorId: string) {
    return this.conversationsService.findByDoctor(doctorId);
  }

  @Get('pharmacists/:pharmacistId/conversations')
  @ApiOperation({ summary: 'Get all conversations for a pharmacist with unread count' })
  findByPharmacist(@Param('pharmacistId') pharmacistId: string) {
    return this.conversationsService.findByPharmacist(pharmacistId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMessages(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.findByConversation(id, page || 1, limit || 50);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  sendMessage(
    @Param('id') conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.create(conversationId, createMessageDto);
  }

  @Patch('conversations/:id/read/:userId')
  @ApiOperation({ summary: 'Mark all messages in conversation as read for a user' })
  markAsRead(
    @Param('id') conversationId: string,
    @Param('userId') userId: string,
  ) {
    return this.messagesService.markAsRead(conversationId, userId);
  }
}
