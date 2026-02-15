import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { PharmacyActivity, PharmacyActivitySchema } from './schemas/pharmacy-activity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService, MongooseModule],
})
export class ActivitiesModule {}
