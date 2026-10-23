import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';

@Module({
  imports: [AiModule, ProgressModule],
  controllers: [PhotoController],
  providers: [PhotoService],
})
export class PhotoModule {}
