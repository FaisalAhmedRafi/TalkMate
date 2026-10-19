import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { WordController } from './word.controller';
import { WordImageService } from './word.images';
import { WordService } from './word.service';

@Module({
  imports: [AiModule, ProgressModule],
  controllers: [WordController],
  providers: [WordService, WordImageService],
  exports: [WordImageService], // Flashcards reuse the Pexels photo lookup
})
export class WordModule {}
