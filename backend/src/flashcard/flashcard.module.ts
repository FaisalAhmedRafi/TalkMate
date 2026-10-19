import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { WordModule } from '../word/word.module';
import { FlashcardController } from './flashcard.controller';
import { FlashcardService } from './flashcard.service';

@Module({
  imports: [AiModule, ProgressModule, WordModule], // WordModule exports the Pexels photo service
  controllers: [FlashcardController],
  providers: [FlashcardService],
})
export class FlashcardModule {}
