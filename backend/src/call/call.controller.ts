import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { LearnerDto } from '../ai/dto';
import { CallAdvancedDto, CallFeedbackDto, CallReplyDto, CallTranslateDto } from './call.dto';
import { CallService } from './call.service';

// Every spoken turn is a reply plus a review, so these routes get the same higher limit as the other chat-style modes.
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('call')
export class CallController {
  constructor(private readonly call: CallService) {}

  /** Kai picks up: his first line */
  @Post('start') start(@Req() req: any, @Body() dto: LearnerDto) { return this.call.start(req.user.id, dto); }

  /** Kai's answer to the learner's latest message (+10 XP) */
  @Post('reply') reply(@Req() req: any, @Body() dto: CallReplyDto) { return this.call.reply(req.user.id, dto); }

  /** Mistakes check for one spoken message */
  @Post('feedback') feedback(@Body() dto: CallFeedbackDto) { return this.call.feedback(dto); }

  /** Translate one of Kai's lines into the learner's native language */
  @Post('translate') translate(@Body() dto: CallTranslateDto) { return this.call.translate(dto); }

  /** Review of the whole call so far (the "Advanced feedback" button) */
  @Post('advanced') advanced(@Body() dto: CallAdvancedDto) { return this.call.advanced(dto); }
}
