import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WordCompleteDto, WordSaveDto, WordStartDto } from './word.dto';
import { WordService } from './word.service';

@UseGuards(AuthGuard)
@Controller('word')
export class WordController {
  constructor(private readonly word: WordService) {}

  /** The star grid with the learner's progress (Word Mode home) */
  @Get('units') units(@Req() req: any) { return this.word.units(req.user.id); }

  /** Stock photos for some words, e.g. /word/covers?ids=apple,house (used by Explore) */
  @Get('covers') covers(@Query('ids') ids = '') { return this.word.covers(ids.split(',').map((x) => x.trim()).filter(Boolean)); }

  /** Open a lesson: resumes an unfinished one, or creates a new one (or restarts it) */
  @Post('start') start(@Req() req: any, @Body() dto: WordStartDto) { return this.word.start(req.user.id, dto); }

  /** Save the current step and scores after every move */
  @Patch('lesson') save(@Req() req: any, @Body() dto: WordSaveDto) { return this.word.save(req.user.id, dto); }

  /** Finish a lesson: pass or not, best score and XP */
  @Post('complete') complete(@Req() req: any, @Body() dto: WordCompleteDto) { return this.word.complete(req.user.id, dto); }
}
