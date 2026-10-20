import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { WordModule } from '../word/word.module';
import { DialogueController } from './dialogue.controller';
import { DialogueService } from './dialogue.service';

@Module({
  imports: [AiModule, ProgressModule, WordModule], // WordModule exports the Pexels photo service
  controllers: [DialogueController],
  providers: [DialogueService],
})
export class DialogueModule {}
