import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { PharmacienSchema } from '../pharmaciens/schemas/pharmacien.schema';
import { PointsCalculatorService } from '../common/services/points-calculator.service';
import { PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';
import { MedicationRequestSchema } from '../medication-requests/schemas/medication-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Rating', schema: RatingSchema },
      { name: 'Pharmacien', schema: PharmacienSchema },
      { name: 'PharmacyActivity', schema: PharmacyActivitySchema },
      { name: 'MedicationRequest', schema: MedicationRequestSchema },
    ]),
  ],
  controllers: [RatingsController],
  providers: [RatingsService, PointsCalculatorService],
  exports: [RatingsService],
})
export class RatingsModule {}
