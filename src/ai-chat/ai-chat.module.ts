import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { GlucoseModule } from '../glucose/glucose.module';

@Module({
  imports: [GlucoseModule], // re-uses GlucoseService (already exported by GlucoseModule)
  controllers: [AiChatController],
  providers: [AiChatService],
})
export class AiChatModule {}
