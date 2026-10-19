import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { FlashCompleteDto, FlashDeckDto, FlashMarkDto } from './flashcard.dto';
import { FlashcardService } from './flashcard.service';

@UseGuards(AuthGuard)
@Controller('flashcards')
export class FlashcardController {
  constructor(private readonly flash: FlashcardService) {}

  /** The topic grid with the learner's progress (Flashcards home) */
  @Get('topics') topics(@Req() req: any) { return this.flash.topics(req.user.id); }

  /** Open a deck: the saved one, or 15 new cards written by the AI */
  @Post('deck') deck(@Req() req: any, @Body() dto: FlashDeckDto) { return this.flash.deck(req.user.id, dto); }

  /** The Daily review: every card marked Learning or flagged, across all decks (up to 15) */
  @Get('review') review(@Req() req: any) { return this.flash.review(req.user.id); }

  /** Save "Learning" / "I know it" / the flag for one card. Clicked quickly, so a higher limit. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Patch('mark') mark(@Req() req: any, @Body() dto: FlashMarkDto) { return this.flash.mark(req.user.id, dto); }

  /** Finish a run through a deck: +10 XP */
  @Post('complete') complete(@Req() req: any, @Body() dto: FlashCompleteDto) { return this.flash.complete(req.user.id, dto); }
}
