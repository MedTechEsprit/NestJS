import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private conversationsService: ConversationsService,
  ) {}

  async create(conversationId: string, createMessageDto: CreateMessageDto): Promise<Message> {
    // Verify conversation exists
    await this.conversationsService.findOne(conversationId);

    const message = new this.messageModel({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(createMessageDto.senderId),
      receiverId: new Types.ObjectId(createMessageDto.receiverId),
      content: createMessageDto.content,
      timestamp: new Date(),
    });

    const savedMessage = await message.save();

    // Update conversation's last message
    await this.conversationsService.updateLastMessage(
      conversationId,
      createMessageDto.content.substring(0, 100),
    );

    return savedMessage;
  }

  async findByConversation(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: Message[]; total: number; page: number; pages: number }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: new Types.ObjectId(conversationId) })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.messageModel.countDocuments({ conversationId: new Types.ObjectId(conversationId) }),
    ]);

    return {
      messages: messages.reverse(), // Oldest first for display
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        receiverId: new Types.ObjectId(userId),
        isRead: false,
      },
      { isRead: true },
    );
  }
}
