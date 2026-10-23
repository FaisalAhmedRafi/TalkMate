import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { CallController } from './call.controller';
import { CallService } from './call.service';

@Module({
  imports: [AiModule, ProgressModule],
  controllers: [CallController],
  providers: [CallService],
})
export class CallModule {}
