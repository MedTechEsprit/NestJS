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
    const isPharmacist = !!createConversationDto.pharmacistId;
    const type = isPharmacist ? 'pharmacist' : 'doctor';

    const filter: any = { patientId: new Types.ObjectId(createConversationDto.patientId) };
    if (isPharmacist) {
      filter.pharmacistId = new Types.ObjectId(createConversationDto.pharmacistId);
    } else {
      filter.doctorId = new Types.ObjectId(createConversationDto.doctorId);
    }

    const existing = await this.conversationModel.findOne(filter);
    if (existing) return existing;

    const doc: any = {
      patientId: new Types.ObjectId(createConversationDto.patientId),
      type,
    };
    if (isPharmacist) doc.pharmacistId = new Types.ObjectId(createConversationDto.pharmacistId);
    else doc.doctorId = new Types.ObjectId(createConversationDto.doctorId);

    const conversation = new this.conversationModel(doc);
    return conversation.save();
  }

  async findByPatient(patientId: string): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('doctorId', 'nom prenom email')
      .populate('pharmacistId', 'nom prenom email nomPharmacie')
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

  async findByPharmacist(pharmacistId: string): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({ pharmacistId: new Types.ObjectId(pharmacistId) })
      .populate('patientId', 'nom prenom email')
      .sort({ lastMessageTime: -1 })
      .lean();

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.messageModel.countDocuments({
          conversationId: conv._id,
          receiverId: new Types.ObjectId(pharmacistId),
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
