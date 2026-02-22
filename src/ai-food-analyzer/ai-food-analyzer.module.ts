import { Module } from '@nestjs/common';
import { AiFoodAnalyzerController } from './ai-food-analyzer.controller';
import { AiFoodAnalyzerService } from './ai-food-analyzer.service';
import { NutritionModule } from '../nutrition/nutrition.module';
import { GlucoseModule } from '../glucose/glucose.module';

@Module({
  imports: [
    NutritionModule, // provides NutritionService (already exported)
    GlucoseModule,   // provides GlucoseService (already exported)
  ],
  controllers: [AiFoodAnalyzerController],
  providers: [AiFoodAnalyzerService],
})
export class AiFoodAnalyzerModule {}
