import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiPredictionController } from './ai-prediction.controller';
import { AiPredictionService } from './ai-prediction.service';
import { AiPrediction, AiPredictionSchema } from './schemas/ai-prediction.schema';
import {
  AiFoodAnalysis,
  AiFoodAnalysisSchema,
} from '../ai-food-analyzer/schemas/ai-food-analysis.schema';
import { GlucoseModule } from '../glucose/glucose.module';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiPrediction.name, schema: AiPredictionSchema },
      { name: 'AiFoodAnalysis', schema: AiFoodAnalysisSchema },
    ]),
    GlucoseModule,    // exports GlucoseService
    NutritionModule,  // exports NutritionService
  ],
  controllers: [AiPredictionController],
  providers: [AiPredictionService],
  exports: [AiPredictionService],   // exported so AiFoodAnalyzerModule can inject it
})
export class AiPredictionModule {}
