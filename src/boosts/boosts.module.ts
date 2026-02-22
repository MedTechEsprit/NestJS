import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoostsController } from './boosts.controller';
import { BoostsService } from './boosts.service';
import { Boost, BoostSchema } from './schemas/boost.schema';
import { PharmacyActivity, PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Boost.name, schema: BoostSchema },
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
    // Import AuthModule to access Pharmacien discriminator model
    AuthModule,
  ],
  controllers: [BoostsController],
  providers: [BoostsService],
  exports: [BoostsService],
})
export class BoostsModule {}
