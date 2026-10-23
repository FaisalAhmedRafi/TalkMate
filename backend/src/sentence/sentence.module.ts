import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { WordModule } from '../word/word.module';
import { SentenceController } from './sentence.controller';
import { SentenceService } from './sentence.service';

@Module({
  imports: [AiModule, ProgressModule, WordModule], // WordModule exports the stock photo service
  controllers: [SentenceController],
  providers: [SentenceService],
})
export class SentenceModule {}
