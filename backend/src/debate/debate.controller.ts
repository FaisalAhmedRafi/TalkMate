import { Body, Controller, Delete, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { DebateFeedbackDto, DebateReplyDto, DebateSaveDto, DebateSessionQueryDto, DebateStartDto, DebateTranslateDto } from './debate.dto';
import { DebateService } from './debate.service';

// Every debate turn is a reply plus a review, so these routes get the same higher limit as /sentence/evaluate.
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('debate')
export class DebateController {
  constructor(private readonly debate: DebateService) {}

  /** The topic grid with a cover photo per topic and what the learner has debated (Debates home) */
  @Get('topics') topics(@Req() req: any) { return this.debate.topics(req.user.id); }

  /** The saved (unfinished) debate for a topic and side: ?topicId=&side= */
  @Get('session') session(@Req() req: any, @Query() q: DebateSessionQueryDto) { return this.debate.session(req.user.id, q); }

  /** Save the whole conversation after every change */
  @Put('session') save(@Req() req: any, @Body() dto: DebateSaveDto) { return this.debate.save(req.user.id, dto); }

  /** Delete the saved debate (start over): ?topicId=&side= */
  @Delete('session') clear(@Req() req: any, @Query() q: DebateSessionQueryDto) { return this.debate.clear(req.user.id, q); }

  /** Opens a debate: the teacher's first message for the chosen topic and side */
  @Post('start') start(@Req() req: any, @Body() dto: DebateStartDto) { return this.debate.start(req.user.id, dto); }

  /** The teacher's answer to the learner's latest message (+10 XP) */
  @Post('reply') reply(@Req() req: any, @Body() dto: DebateReplyDto) { return this.debate.reply(req.user.id, dto); }

  /** Mistakes check and translation for one learner message */
  @Post('feedback') feedback(@Body() dto: DebateFeedbackDto) { return this.debate.feedback(dto); }

  /** Translate one message into the learner's native language */
  @Post('translate') translate(@Body() dto: DebateTranslateDto) { return this.debate.translate(dto); }
}
