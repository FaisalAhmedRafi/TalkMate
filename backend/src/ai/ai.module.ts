import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenRouterService } from './openrouter.service';

@Module({
  controllers: [AiController],
  providers: [AiService, OpenRouterService],
  exports: [OpenRouterService], // Sentence Mode scores pronunciation through the same client
})
export class AiModule {}
