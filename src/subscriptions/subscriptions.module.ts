import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  PatientSubscription,
  PatientSubscriptionSchema,
} from './schemas/patient-subscription.schema';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PremiumGuard } from './guards/premium.guard';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PatientSubscription.name, schema: PatientSubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PremiumGuard],
  exports: [SubscriptionsService, PremiumGuard, MongooseModule],
})
export class SubscriptionsModule {}