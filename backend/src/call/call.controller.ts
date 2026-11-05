import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CallAdvancedDto, CallFeedbackDto, CallReplyDto, CallSaveDto, CallStartDto, CallTranslateDto } from './call.dto';
import { CallService } from './call.service';

// Every spoken turn is a reply plus a review, so these routes get the same higher limit as the other chat-style modes.
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('call')
export class CallController {
  constructor(private readonly call: CallService) {}

  /** The open call, or { session: null } */
  @Get('session') session(@Req() req: any) { return this.call.session(req.user.id); }

  /** Save the whole open call after every change */
  @Put('session') save(@Req() req: any, @Body() dto: CallSaveDto) { return this.call.save(req.user.id, dto); }

  /** "Start a new call": moves the open call to the history */
  @Post('archive') archive(@Req() req: any) { return this.call.archive(req.user.id); }

  /** Call history list */
  @Get('history') history(@Req() req: any) { return this.call.history(req.user.id); }

  /** Opens a call from the history */
  @Post('history/:id/open') open(@Req() req: any, @Param('id') id: string) { return this.call.open(req.user.id, id); }

  @Delete('history/:id') remove(@Req() req: any, @Param('id') id: string) { return this.call.remove(req.user.id, id); }

  /** The tutor picks up: their first line */
  @Post('start') start(@Req() req: any, @Body() dto: CallStartDto) { return this.call.start(req.user.id, dto); }

  /** The tutor's answer to the learner's latest message (+10 XP) */
  @Post('reply') reply(@Req() req: any, @Body() dto: CallReplyDto) { return this.call.reply(req.user.id, dto); }

  /** Mistakes check for one spoken message */
  @Post('feedback') feedback(@Body() dto: CallFeedbackDto) { return this.call.feedback(dto); }

  /** Translate one of the tutor's lines into the learner's native language */
  @Post('translate') translate(@Body() dto: CallTranslateDto) { return this.call.translate(dto); }

  /** Review of the whole call so far (the "Advanced feedback" button) */
  @Post('advanced') advanced(@Body() dto: CallAdvancedDto) { return this.call.advanced(dto); }
}
