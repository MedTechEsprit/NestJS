import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto';
import { ConversationsService } from '../conversations/conversations.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { FirebaseService, FirebaseUserType } from '../firebase/firebase.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private conversationsService: ConversationsService,
    private readonly firebaseService: FirebaseService,
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

    const [sender, receiver] = await Promise.all([
      this.userModel
        .findById(createMessageDto.senderId)
        .select('nom prenom role')
        .lean(),
      this.userModel
        .findById(createMessageDto.receiverId)
        .select('role')
        .lean(),
    ]);

    const senderFullName = `${sender?.prenom || ''} ${sender?.nom || ''}`.trim() || 'Utilisateur';
    const receiverUserType = this.roleToUserType((receiver as any)?.role);
    const senderRole = String((sender as any)?.role || '').toUpperCase();

    if (receiverUserType) {
      let title = 'Nouveau message';
      if (receiverUserType === 'doctor' && senderRole === 'PATIENT') {
        title = 'Nouveau message patient';
      } else if (receiverUserType === 'patient' && senderRole === 'MEDECIN') {
        title = 'Nouveau message';
      } else if (receiverUserType === 'doctor' && senderRole === 'PHARMACIEN') {
        title = 'Nouveau message pharmacie';
      } else if (receiverUserType === 'pharmacy' && senderRole === 'PATIENT') {
        title = 'Nouveau message patient';
      } else if (receiverUserType === 'pharmacy' && senderRole === 'MEDECIN') {
        title = 'Nouvelle ordonnance';
      }

      // Trigger: notify the message receiver (patient/doctor/pharmacy) when a new message is sent.
      await this.firebaseService.sendToUser(
        createMessageDto.receiverId,
        receiverUserType,
        title,
        `${senderFullName} vous a envoyé un message`,
        {
          conversationId: String(conversationId),
          messageId: String((savedMessage as any)._id),
          senderId: String(createMessageDto.senderId),
          receiverId: String(createMessageDto.receiverId),
        },
      );
    }

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

  private roleToUserType(role?: string): FirebaseUserType | null {
    const normalized = String(role || '').toUpperCase();
    if (normalized === 'PATIENT') return 'patient';
    if (normalized === 'MEDECIN') return 'doctor';
    if (normalized === 'PHARMACIEN') return 'pharmacy';
    return null;
  }
}
