import { Body, Controller, Delete, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import {
  CharacterFeedbackDto, CharacterReplyDto, CharacterSaveDto, CharacterSessionQueryDto, CharacterStartDto, CharacterTranslateDto,
} from './characters.dto';
import { CharactersService } from './characters.service';

// Every turn is a reply plus a review, so these routes get the same higher limit as /debate and /sentence/evaluate.
@UseGuards(AuthGuard)
@Throttle({ default: { limit: 40, ttl: 60_000 } })
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  /** The character grid with what the learner has already talked to (Characters home) */
  @Get() list(@Req() req: any) { return this.characters.list(req.user.id); }

  /** The saved (unfinished) conversation with a character: ?characterId= */
  @Get('session') session(@Req() req: any, @Query() q: CharacterSessionQueryDto) { return this.characters.session(req.user.id, q); }

  /** Save the whole conversation after every change */
  @Put('session') save(@Req() req: any, @Body() dto: CharacterSaveDto) { return this.characters.save(req.user.id, dto); }

  /** Delete the saved conversation (start over): ?characterId= */
  @Delete('session') clear(@Req() req: any, @Query() q: CharacterSessionQueryDto) { return this.characters.clear(req.user.id, q); }

  /** Opens a conversation: the character's first message */
  @Post('start') start(@Req() req: any, @Body() dto: CharacterStartDto) { return this.characters.start(req.user.id, dto); }

  /** The character's answer to the learner's latest message (+10 XP) */
  @Post('reply') reply(@Req() req: any, @Body() dto: CharacterReplyDto) { return this.characters.reply(req.user.id, dto); }

  /** Mistakes check and translation for one learner message */
  @Post('feedback') feedback(@Body() dto: CharacterFeedbackDto) { return this.characters.feedback(dto); }

  /** Translate one message into the learner's native language */
  @Post('translate') translate(@Body() dto: CharacterTranslateDto) { return this.characters.translate(dto); }
}
