import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  PatientSubscription,
  PatientSubscriptionSchema,
} from './schemas/patient-subscription.schema';
import {
  RevenueCatWebhookEvent,
  RevenueCatWebhookEventSchema,
} from './schemas/revenuecat-webhook-event.schema';
import {
  MedecinBoostSubscription,
  MedecinBoostSubscriptionSchema,
} from '../medecins/schemas/medecin-boost-subscription.schema';
import { SubscriptionsController } from './subscriptions.controller';
import { RevenueCatBillingService } from './revenuecat-billing.service';
import { PremiumGuard } from './guards/premium.guard';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PatientSubscription.name, schema: PatientSubscriptionSchema },
      { name: RevenueCatWebhookEvent.name, schema: RevenueCatWebhookEventSchema },
      { name: MedecinBoostSubscription.name, schema: MedecinBoostSubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [RevenueCatBillingService, PremiumGuard],
  exports: [RevenueCatBillingService, PremiumGuard, MongooseModule],
})
export class SubscriptionsModule {}