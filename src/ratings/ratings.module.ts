import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { PointsCalculatorService } from '../common/services/points-calculator.service';
import { PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';
import { MedicationRequestSchema } from '../medication-requests/schemas/medication-request.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Rating', schema: RatingSchema },
      { name: 'PharmacyActivity', schema: PharmacyActivitySchema },
      { name: 'MedicationRequest', schema: MedicationRequestSchema },
    ]),
    // Import AuthModule to access Pharmacien discriminator model
    AuthModule,
  ],
  controllers: [RatingsController],
  providers: [RatingsService, PointsCalculatorService],
  exports: [RatingsService],
})
export class RatingsModule {}
