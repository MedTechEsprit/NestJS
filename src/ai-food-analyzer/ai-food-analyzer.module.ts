import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiFoodAnalyzerController } from './ai-food-analyzer.controller';
import { AiFoodAnalyzerService } from './ai-food-analyzer.service';
import { NutritionModule } from '../nutrition/nutrition.module';
import { GlucoseModule } from '../glucose/glucose.module';
import { PatientsModule } from '../patients/patients.module';
import { AiPredictionModule } from '../ai-prediction/ai-prediction.module';
import {
  AiFoodAnalysis,
  AiFoodAnalysisSchema,
} from './schemas/ai-food-analysis.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AiFoodAnalysis.name, schema: AiFoodAnalysisSchema },
    ]),
    NutritionModule,  // provides NutritionService
    GlucoseModule,    // provides GlucoseService
    PatientsModule,   // provides PatientsService (patient profile)
    AiPredictionModule, // provides AiPredictionService (auto post-meal prediction)
  ],
  controllers: [AiFoodAnalyzerController],
  providers: [AiFoodAnalyzerService],
})
export class AiFoodAnalyzerModule {}
