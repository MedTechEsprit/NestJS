import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoostsController } from './boosts.controller';
import { BoostsService } from './boosts.service';
import { Boost, BoostSchema } from './schemas/boost.schema';
import { Pharmacien, PharmacienSchema } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Boost.name, schema: BoostSchema },
      { name: Pharmacien.name, schema: PharmacienSchema },
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
  ],
  controllers: [BoostsController],
  providers: [BoostsService],
  exports: [BoostsService],
})
export class BoostsModule {}
