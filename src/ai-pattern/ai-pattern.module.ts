import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiPattern, AiPatternSchema } from './schemas/ai-pattern.schema';
import { AiPatternController } from './ai-pattern.controller';
import { AiPatternService } from './ai-pattern.service';
import { GlucoseModule } from '../glucose/glucose.module';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiPattern.name, schema: AiPatternSchema },
    ]),
    GlucoseModule,    // exports GlucoseService
    NutritionModule,  // exports NutritionService
  ],
  controllers: [AiPatternController],
  providers: [AiPatternService],
  exports: [AiPatternService],
})
export class AiPatternModule {}
