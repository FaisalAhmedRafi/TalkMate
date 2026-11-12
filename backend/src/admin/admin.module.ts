import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { WordModule } from '../word/word.module';
import { AdminController, ContentController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [WordModule, CharactersModule], // stock-photo lookup (WordImageService) and the character pictures
  controllers: [AdminController, ContentController],
  providers: [AdminService, AnalyticsService, AdminGuard],
})
export class AdminModule {}
