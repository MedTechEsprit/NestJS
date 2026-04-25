import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType, NotificationSeverity } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterTokenDto, RegisterTokenUserType } from './dto/register-token.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Helper method to send notifications from other modules
   */
  async send(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedId?: string,
    severity: NotificationSeverity = NotificationSeverity.INFO,
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body: message,
      message,
      data: relatedId ? { relatedId: String(relatedId) } : {},
      relatedId: relatedId ? new Types.ObjectId(relatedId) : undefined,
      severity,
      timestamp: new Date(),
    });
    return notification.save();
  }

  async create(createDto: CreateNotificationDto): Promise<Notification> {
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(createDto.userId),
      type: createDto.type,
      title: createDto.title,
      body: createDto.message,
      message: createDto.message,
      relatedId: createDto.relatedId ? new Types.ObjectId(createDto.relatedId) : undefined,
      severity: createDto.severity || NotificationSeverity.INFO,
      timestamp: new Date(),
    });
    return notification.save();
  }

  async findByUser(
    userId: string,
    options: {
      unreadOnly?: boolean;
      type?: NotificationType;
      limit?: number;
    } = {},
  ): Promise<Notification[]> {
    const query: any = { userId: new Types.ObjectId(userId) };

    if (options.unreadOnly) {
      query.isRead = false;
    }

    if (options.type) {
      query.type = options.type;
    }

    let queryBuilder = this.notificationModel
      .find(query)
      .sort({ timestamp: -1 });

    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    return queryBuilder.lean();
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationModel.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async registerToken(dto: RegisterTokenDto): Promise<{ success: boolean }> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(dto.userId), role: this.userTypeToRole(dto.userType) },
      { $addToSet: { fcmTokens: dto.fcmToken } },
    );
    return { success: true };
  }

  async removeToken(dto: RegisterTokenDto): Promise<{ success: boolean }> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(dto.userId), role: this.userTypeToRole(dto.userType) },
      { $pull: { fcmTokens: dto.fcmToken } },
    );
    return { success: true };
  }

  async getMyNotifications(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1, timestamp: -1 })
      .lean();
  }

  private userTypeToRole(userType: RegisterTokenUserType): string {
    if (userType === RegisterTokenUserType.PATIENT) return 'PATIENT';
    if (userType === RegisterTokenUserType.DOCTOR) return 'MEDECIN';
    return 'PHARMACIEN';
  }
}
