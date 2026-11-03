import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { ChatFeedbackDto, ChatReplyDto, ChatSaveDto, ChatStartDto, ChatSuggestDto, ChatTranslateDto } from './chat.dto';
import { ChatService } from './chat.service';

// Every turn is a reply, a review and a suggestion bar, so these routes get the same higher limit as /roleplay and /debate.
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** The open chat, or { session: null } */
  @Get('session') session(@Req() req: any) { return this.chat.session(req.user.id); }

  /** Save the whole open chat after every change */
  @Put('session') save(@Req() req: any, @Body() dto: ChatSaveDto) { return this.chat.save(req.user.id, dto); }

  /** "Start a new chat": moves the open chat to the history */
  @Post('archive') archive(@Req() req: any) { return this.chat.archive(req.user.id); }

  /** Chat history list */
  @Get('history') history(@Req() req: any) { return this.chat.history(req.user.id); }

  /** Opens a chat from the history */
  @Post('history/:id/open') open(@Req() req: any, @Param('id') id: string) { return this.chat.open(req.user.id, id); }

  @Delete('history/:id') remove(@Req() req: any, @Param('id') id: string) { return this.chat.remove(req.user.id, id); }

  /** The tutor's greeting for a new chat */
  @Post('start') start(@Body() dto: ChatStartDto) { return this.chat.start(dto); }

  /** The tutor's answer to the learner's latest message (+10 XP) */
  @Post('reply') reply(@Req() req: any, @Body() dto: ChatReplyDto) { return this.chat.reply(req.user.id, dto); }

  /** Three tappable replies (suggestion bar) */
  @Post('suggestions') suggestions(@Body() dto: ChatSuggestDto) { return this.chat.suggestions(dto); }

  /** Mistakes check and translation for one learner message */
  @Post('feedback') feedback(@Body() dto: ChatFeedbackDto) { return this.chat.feedback(dto); }

  /** Translate one message into the learner's native language */
  @Post('translate') translate(@Body() dto: ChatTranslateDto) { return this.chat.translate(dto); }
}
