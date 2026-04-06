import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PatientSubscription,
  PatientSubscriptionDocument,
} from '../schemas/patient-subscription.schema';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    @InjectModel(PatientSubscription.name)
    private readonly subscriptionModel: Model<PatientSubscriptionDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId) {
      if (!user?._id) {
        throw new ForbiddenException('Utilisateur non authentifié');
      }
    }

    const userRole = String(user.role || '').toUpperCase();
    if (userRole !== 'PATIENT') {
      return true;
    }

    const patientId = user.userId || user._id?.toString();

    const sub = await this.subscriptionModel.findOne({
      patientId: new Types.ObjectId(patientId),
      isActive: true,
    });

    if (!sub) {
      throw new ForbiddenException(
        'Abonnement Premium requis pour accéder aux fonctionnalités IA',
      );
    }

    if (sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) {
      throw new ForbiddenException('Votre abonnement Premium a expiré');
    }

    return true;
  }
}