import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedecinsService } from './medecins.service';
import { MedecinsController } from './medecins.controller';
import { AuthModule } from '../auth/auth.module';
import { GlucoseModule } from '../glucose/glucose.module';
import {
  MedecinBoostSubscription,
  MedecinBoostSubscriptionSchema,
} from './schemas/medecin-boost-subscription.schema';

@Module({
  imports: [
    // Import AuthModule to access Medecin discriminator model
    AuthModule,
    GlucoseModule,
    MongooseModule.forFeature([
      {
        name: MedecinBoostSubscription.name,
        schema: MedecinBoostSubscriptionSchema,
      },
    ]),
  ],
  controllers: [MedecinsController],
  providers: [MedecinsService],
  exports: [MedecinsService],
})
export class MedecinsModule {}
