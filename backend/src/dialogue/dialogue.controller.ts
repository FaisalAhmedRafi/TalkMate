import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DialogueCompleteDto, DialogueSessionDto } from './dialogue.dto';
import { DialogueService } from './dialogue.service';

@UseGuards(AuthGuard)
@Controller('dialogue')
export class DialogueController {
  constructor(private readonly dialogue: DialogueService) {}

  /** The topic grid with a cover and the learner's progress per topic (Dialogue Mode home) */
  @Get('topics') topics(@Req() req: any) { return this.dialogue.topics(req.user.id); }

  /** The scripted conversation for one topic (the saved script, or a new one written by the AI) */
  @Post('session') session(@Body() dto: DialogueSessionDto) { return this.dialogue.session(dto); }

  /** Store a finished dialogue (pass/fail, best score) and award XP */
  @Post('complete') complete(@Req() req: any, @Body() dto: DialogueCompleteDto) { return this.dialogue.complete(req.user.id, dto); }
}
