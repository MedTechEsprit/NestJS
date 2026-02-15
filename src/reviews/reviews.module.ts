import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review, ReviewSchema } from './schemas/review.schema';
import { Pharmacien, PharmacienSchema } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Pharmacien.name, schema: PharmacienSchema },
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
