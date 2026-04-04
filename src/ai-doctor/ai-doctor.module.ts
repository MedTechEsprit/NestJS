import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiDoctorController } from './ai-doctor.controller';
import { AiDoctorService } from './ai-doctor.service';
import {
  AiDoctorChat,
  AiDoctorChatSchema,
} from './schemas/ai-doctor-chat.schema';
import {
  AiPrediction,
  AiPredictionSchema,
} from '../ai-prediction/schemas/ai-prediction.schema';
import { GlucoseModule } from '../glucose/glucose.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { MedecinsModule } from '../medecins/medecins.module';
import { AuthModule } from '../auth/auth.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiDoctorChat.name, schema: AiDoctorChatSchema },
      { name: 'AiPrediction', schema: AiPredictionSchema },
    ]),
    GlucoseModule,    // exports GlucoseService
    NutritionModule,  // exports NutritionService
    MedecinsModule,   // exports MedecinsService (listePatients, ownership check)
    AuthModule,       // provides Medecin discriminator model
    PatientsModule,
  ],
  controllers: [AiDoctorController],
  providers: [AiDoctorService],
})
export class AiDoctorModule {}
