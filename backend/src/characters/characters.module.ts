import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ProgressModule } from '../progress/progress.module';
import { CharacterPhotoService } from './characters.photos';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({
  imports: [AiModule, ProgressModule],
  controllers: [CharactersController],
  providers: [CharactersService, CharacterPhotoService],
  exports: [CharacterPhotoService], // the Admin panel shows the same pictures in its table
})
export class CharactersModule {}
