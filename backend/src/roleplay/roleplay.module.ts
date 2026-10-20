import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { WordModule } from '../word/word.module';
import { RoleplayController } from './roleplay.controller';
import { RoleplayService } from './roleplay.service';

@Module({
  imports: [AiModule, ProgressModule, WordModule], // WordModule exports the Pexels photo service
  controllers: [RoleplayController],
  providers: [RoleplayService],
})
export class RoleplayModule {}
