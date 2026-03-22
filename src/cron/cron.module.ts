import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CronService } from './cron.service';
import { MedicationRequest, MedicationRequestSchema } from '../medication-requests/schemas/medication-request.schema';
import { PharmacyActivity, PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';
import { AuthModule } from '../auth/auth.module';
import { AiPatternModule } from '../ai-pattern/ai-pattern.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicationRequest.name, schema: MedicationRequestSchema },
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
    AuthModule,
    AiPatternModule,
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
