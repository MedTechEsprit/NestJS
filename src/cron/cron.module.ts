import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CronService } from './cron.service';
import { MedicationRequest, MedicationRequestSchema } from '../medication-requests/schemas/medication-request.schema';
import { Pharmacien, PharmacienSchema } from '../pharmaciens/schemas/pharmacien.schema';
import { PharmacyActivity, PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicationRequest.name, schema: MedicationRequestSchema },
      { name: Pharmacien.name, schema: PharmacienSchema },
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
