import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AiService } from './ai.service';
import { ChatDto, FeedbackDto, GenerateDto, PhotoDto } from './dto';

@UseGuards(AuthGuard) // keeps the free-model quota for logged-in users
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Chat, Call, Roleplays (Characters and Debates have their own modules) */
  @Post('chat') chat(@Body() dto: ChatDto) { return this.ai.chat(dto); }

  /** Sentence, Word, Dialogue, Flashcards (returns JSON study material) */
  @Post('generate') generate(@Body() dto: GenerateDto) { return this.ai.generate(dto); }

  /** Photo mode: image + optional learner description */
  @Post('photo') photo(@Body() dto: PhotoDto) { return this.ai.photo(dto); }

  /** Daily feedback from today's practice messages */
  @Post('feedback') feedback(@Body() dto: FeedbackDto) { return this.ai.feedback(dto); }
}
