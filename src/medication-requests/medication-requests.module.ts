import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedicationRequestsController } from './medication-requests.controller';
import { MedicationRequestsService } from './medication-requests.service';
import { MedicationRequest, MedicationRequestSchema } from './schemas/medication-request.schema';
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
  controllers: [MedicationRequestsController],
  providers: [MedicationRequestsService],
  exports: [MedicationRequestsService],
})
export class MedicationRequestsModule {}
