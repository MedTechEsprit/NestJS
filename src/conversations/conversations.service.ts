import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import { CreateConversationDto } from './dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async create(createConversationDto: CreateConversationDto): Promise<Conversation> {
    // Check if conversation already exists
    const existing = await this.conversationModel.findOne({
      patientId: new Types.ObjectId(createConversationDto.patientId),
      doctorId: new Types.ObjectId(createConversationDto.doctorId),
    });

    if (existing) {
      return existing;
    }

    const conversation = new this.conversationModel({
      patientId: new Types.ObjectId(createConversationDto.patientId),
      doctorId: new Types.ObjectId(createConversationDto.doctorId),
    });
    return conversation.save();
  }

  async findByPatient(patientId: string): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('doctorId', 'nom prenom email')
      .sort({ lastMessageTime: -1 })
      .lean();

    // Get unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.messageModel.countDocuments({
          conversationId: conv._id,
          receiverId: new Types.ObjectId(patientId),
          isRead: false,
        });
        return { ...conv, unreadCount };
      }),
    );

    return result;
  }

  async findByDoctor(doctorId: string): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({ doctorId: new Types.ObjectId(doctorId) })
      .populate('patientId', 'nom prenom email')
      .sort({ lastMessageTime: -1 })
      .lean();

    // Get unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.messageModel.countDocuments({
          conversationId: conv._id,
          receiverId: new Types.ObjectId(doctorId),
          isRead: false,
        });
        return { ...conv, unreadCount };
      }),
    );

    return result;
  }

  async findOne(id: string): Promise<Conversation> {
    const conversation = await this.conversationModel.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation #${id} not found`);
    }
    return conversation;
  }

  async updateLastMessage(conversationId: string, message: string): Promise<void> {
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: message,
      lastMessageTime: new Date(),
    });
  }
}
