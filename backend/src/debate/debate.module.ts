import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { WordModule } from '../word/word.module';
import { DebateController } from './debate.controller';
import { DebateService } from './debate.service';

@Module({
  imports: [AiModule, ProgressModule, WordModule], // WordModule exports the Pexels photo service
  controllers: [DebateController],
  providers: [DebateService],
})
export class DebateModule {}
