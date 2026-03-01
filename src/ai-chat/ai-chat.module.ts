import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { GlucoseModule } from '../glucose/glucose.module';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [
    GlucoseModule,    // exports GlucoseService
    NutritionModule,  // exports NutritionService
  ],
  controllers: [AiChatController],
  providers: [AiChatService],
})
export class AiChatModule {}
