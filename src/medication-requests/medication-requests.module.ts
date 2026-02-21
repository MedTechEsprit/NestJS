import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedicationRequestsController } from './medication-requests.controller';
import { MedicationRequestsService } from './medication-requests.service';
import { MedicationRequest, MedicationRequestSchema } from './schemas/medication-request.schema';
import { PharmacyActivity, PharmacyActivitySchema } from '../activities/schemas/pharmacy-activity.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicationRequest.name, schema: MedicationRequestSchema },
      { name: PharmacyActivity.name, schema: PharmacyActivitySchema },
    ]),
    // Import AuthModule to access Pharmacien discriminator model
    AuthModule,
  ],
  controllers: [MedicationRequestsController],
  providers: [MedicationRequestsService],
  exports: [MedicationRequestsService],
})
export class MedicationRequestsModule {}
