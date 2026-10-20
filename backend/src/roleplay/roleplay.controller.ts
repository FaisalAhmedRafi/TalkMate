import { Body, Controller, Delete, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { RoleplayFeedbackDto, RoleplayReplyDto, RoleplaySaveDto, RoleplaySessionQueryDto, RoleplayStartDto, RoleplayTranslateDto } from './roleplay.dto';
import { RoleplayService } from './roleplay.service';

// Every turn is a reply plus a review, so these routes get the same higher limit as /debate and /sentence/evaluate.
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('roleplay')
export class RoleplayController {
  constructor(private readonly roleplay: RoleplayService) {}

  /** The scenario grid with a cover photo per scenario and what the learner has practised (Roleplays home + intro pages) */
  @Get('scenarios') scenarios(@Req() req: any) { return this.roleplay.scenarios(req.user.id); }

  /** The saved (unfinished) chat for a scenario: ?scenarioId= */
  @Get('session') session(@Req() req: any, @Query() q: RoleplaySessionQueryDto) { return this.roleplay.session(req.user.id, q); }

  /** Save the whole conversation after every change */
  @Put('session') save(@Req() req: any, @Body() dto: RoleplaySaveDto) { return this.roleplay.save(req.user.id, dto); }

  /** Delete the saved chat (start over): ?scenarioId= */
  @Delete('session') clear(@Req() req: any, @Query() q: RoleplaySessionQueryDto) { return this.roleplay.clear(req.user.id, q); }

  /** Opens a scenario: the partner's first line */
  @Post('start') start(@Body() dto: RoleplayStartDto) { return this.roleplay.start(dto); }

  /** The partner's answer to the learner's latest message (+10 XP) */
  @Post('reply') reply(@Req() req: any, @Body() dto: RoleplayReplyDto) { return this.roleplay.reply(req.user.id, dto); }

  /** Mistakes check and translation for one learner message */
  @Post('feedback') feedback(@Body() dto: RoleplayFeedbackDto) { return this.roleplay.feedback(dto); }

  /** Translate one message into the learner's native language */
  @Post('translate') translate(@Body() dto: RoleplayTranslateDto) { return this.roleplay.translate(dto); }
}
