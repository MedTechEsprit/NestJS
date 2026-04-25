import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Notification,
  NotificationDocument,
  NotificationSeverity,
  NotificationType,
} from '../notifications/schemas/notification.schema';

export type FirebaseUserType = 'patient' | 'doctor' | 'pharmacy';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseReady = false;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    if (admin.apps.length) {
      this.firebaseReady = true;
      return;
    }

    try {
      const serviceAccount = this.loadServiceAccount();
      if (!serviceAccount) {
        this.logger.warn(
          'Firebase credentials not found. Push notifications are disabled.',
        );
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.firebaseReady = true;
    } catch (error: any) {
      this.logger.error(
        `Firebase initialization failed: ${error?.message || error}`,
      );
      this.firebaseReady = false;
    }
  }

  private loadServiceAccount(): admin.ServiceAccount | null {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      return {
        projectId,
        clientEmail,
        privateKey,
      };
    }

    const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');
    if (!existsSync(serviceAccountPath)) {
      return null;
    }

    const rawJson = readFileSync(serviceAccountPath, 'utf8').trim();
    if (!rawJson) {
      return null;
    }

    return JSON.parse(rawJson) as admin.ServiceAccount;
  }

  private canSendNotifications(): boolean {
    if (this.firebaseReady) {
      return true;
    }

    this.logger.warn('Firebase is not initialized. Notification send skipped.');
    return false;
  }

  async sendToOne(
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.canSendNotifications()) {
      return;
    }

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data,
      });
    } catch (error: any) {
      this.logger.warn(`FCM sendToOne failed: ${error?.message || error}`);
      if (this.isTokenNotRegisteredError(error?.code)) {
        await this.removeTokenGlobally(fcmToken);
      }
    }
  }

  async sendToMany(
    fcmTokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.canSendNotifications()) {
      return;
    }

    const uniqueTokens = [...new Set((fcmTokens || []).filter(Boolean))];
    if (uniqueTokens.length === 0) {
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: uniqueTokens,
        notification: { title, body },
        data,
      });

      const invalidTokens: string[] = [];
      response.responses.forEach((result, index) => {
        if (result.error && this.isTokenNotRegisteredError(result.error.code)) {
          invalidTokens.push(uniqueTokens[index]);
        }
      });

      if (invalidTokens.length > 0) {
        await this.removeTokensGlobally(invalidTokens);
      }
    } catch (error: any) {
      this.logger.warn(`FCM sendToMany failed: ${error?.message || error}`);
    }
  }

  async sendToUser(
    userId: string,
    userType: FirebaseUserType,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.canSendNotifications()) {
      return;
    }

    const role = this.userTypeToRole(userType);
    const user = await this.userModel
      .findOne({ _id: new Types.ObjectId(userId), role })
      .select('_id fcmTokens role')
      .lean();

    if (!user) {
      return;
    }

    await this.saveNotificationHistory(userId, userType, title, body, data);

    const rawTokens = Array.isArray((user as any).fcmTokens)
      ? ((user as any).fcmTokens as string[])
      : [];
    const tokens: string[] = [...new Set(rawTokens.filter(Boolean))];
    if (tokens.length === 0) {
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
      });

      const invalidTokens: string[] = [];
      response.responses.forEach((result, index) => {
        if (result.error && this.isTokenNotRegisteredError(result.error.code)) {
          invalidTokens.push(tokens[index]);
        }
      });

      if (invalidTokens.length > 0) {
        await this.userModel.updateOne(
          { _id: new Types.ObjectId(userId) },
          { $pull: { fcmTokens: { $in: invalidTokens } } },
        );
      }
    } catch (error: any) {
      this.logger.warn(`FCM sendToUser failed: ${error?.message || error}`);
    }
  }

  private async saveNotificationHistory(
    userId: string,
    userType: FirebaseUserType,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    try {
      await this.notificationModel.create({
        userId: new Types.ObjectId(userId),
        userType,
        type: NotificationType.MESSAGE,
        title,
        body,
        message: body,
        data,
        severity: NotificationSeverity.INFO,
        timestamp: new Date(),
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to persist notification history: ${error?.message || error}`,
      );
    }
  }

  private async removeTokenGlobally(token: string): Promise<void> {
    await this.userModel.updateMany(
      { fcmTokens: token },
      { $pull: { fcmTokens: token } },
    );
  }

  private async removeTokensGlobally(tokens: string[]): Promise<void> {
    await this.userModel.updateMany(
      { fcmTokens: { $in: tokens } },
      { $pull: { fcmTokens: { $in: tokens } } },
    );
  }

  private isTokenNotRegisteredError(code?: string): boolean {
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  }

  private userTypeToRole(userType: FirebaseUserType): string {
    if (userType === 'patient') return 'PATIENT';
    if (userType === 'doctor') return 'MEDECIN';
    return 'PHARMACIEN';
  }
}
