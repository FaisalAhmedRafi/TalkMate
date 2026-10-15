import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CompleteDto, EvaluateDto, SessionDto } from './sentence.dto';
import { SentenceService } from './sentence.service';

@UseGuards(AuthGuard)
@Controller('sentence')
export class SentenceController {
  constructor(private readonly sentence: SentenceService) {}

  /** Unit list + the learner's progress (Sentence Mode home) */
  @Get('units') units(@Req() req: any) { return this.sentence.units(req.user.id); }

  /** 5 AI-written sentences for one skill */
  @Post('session') session(@Body() dto: SessionDto) { return this.sentence.session(dto); }

  /** 1-5 pronunciation rating for one spoken sentence. Higher limit: a session can retry a lot. */
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('evaluate') evaluate(@Body() dto: EvaluateDto) { return this.sentence.evaluate(dto); }

  /** Store a finished session (pass/fail, best score) and award XP */
  @Post('complete') complete(@Req() req: any, @Body() dto: CompleteDto) { return this.sentence.complete(req.user.id, dto); }
}
