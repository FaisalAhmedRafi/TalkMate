import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountModule } from './account/account.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { DialogueModule } from './dialogue/dialogue.module';
import { FlashcardModule } from './flashcard/flashcard.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { SentenceModule } from './sentence/sentence.module';
import { WordModule } from './word/word.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Free OpenRouter models are rate limited, so throttle per client too.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    ProgressModule,
    AccountModule,
    AiModule,
    SentenceModule,
    WordModule,
    FlashcardModule,
    DialogueModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
