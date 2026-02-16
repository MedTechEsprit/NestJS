import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Créer une nouvelle session
   */
  async createSession(
    userId: string,
    token: string,
    expiresAt: Date,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      token,
      expiresAt,
      deviceInfo,
      ipAddress,
      userAgent,
      isActive: true,
      lastActivityAt: new Date(),
    });

    return session;
  }

  /**
   * Trouver une session par token
   */
  async findByToken(token: string): Promise<SessionDocument | null> {
    return this.sessionModel.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Récupérer toutes les sessions actives d'un utilisateur
   */
  async getActiveSessions(userId: string): Promise<SessionDocument[]> {
    return this.sessionModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActivityAt: -1 });
  }

  /**
   * Mettre à jour la dernière activité d'une session
   */
  async updateActivity(token: string): Promise<void> {
    await this.sessionModel.updateOne(
      { token },
      { lastActivityAt: new Date() },
    );
  }

  /**
   * Révoquer une session (logout)
   */
  async revokeSession(token: string): Promise<void> {
    const result = await this.sessionModel.updateOne(
      { token },
      { isActive: false },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Session non trouvée');
    }
  }

  /**
   * Révoquer une session spécifique par ID
   */
  async revokeSessionById(userId: string, sessionId: string): Promise<void> {
    const result = await this.sessionModel.updateOne(
      {
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(userId),
      },
      { isActive: false },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Session non trouvée ou non autorisée');
    }
  }

  /**
   * Révoquer toutes les sessions d'un utilisateur (logout all devices)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.sessionModel.updateMany(
      { userId: new Types.ObjectId(userId), isActive: true },
      { isActive: false },
    );

    return result.modifiedCount;
  }

  /**
   * Supprimer les sessions expirées (cleanup)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  }

  /**
   * Compter les sessions actives d'un utilisateur
   */
  async countActiveSessions(userId: string): Promise<number> {
    return this.sessionModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isActive: true,
      expiresAt: { $gt: new Date() },
    });
  }
}
