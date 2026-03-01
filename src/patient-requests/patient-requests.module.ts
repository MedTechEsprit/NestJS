import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PatientRequestsService } from './patient-requests.service';
import { PatientRequestsController } from './patient-requests.controller';
import { PatientRequest, PatientRequestSchema } from './schemas/patient-request.schema';
import { MedecinsModule } from '../medecins/medecins.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PatientRequest.name, schema: PatientRequestSchema }]),
    MedecinsModule,
  ],
  controllers: [PatientRequestsController],
  providers: [PatientRequestsService],
  exports: [PatientRequestsService],
})
export class PatientRequestsModule {}
