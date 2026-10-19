import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OpenRouterService } from '../ai/openrouter.service';
import { Learner } from '../ai/prompts';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { WordImage, WordImageService } from '../word/word.images';
import { CARDS_PER_DECK, FLASH_TOPICS, findTopic, FlashTopic } from './flashcard.catalog';
import { FlashCompleteDto, FlashDeckDto, FlashMarkDto } from './flashcard.dto';
import { deckSystem } from './flashcard.prompts';

type Status = 'new' | 'learning' | 'known';
type StoredCard = { term: string; translation: string; example: string; exampleTranslation: string; photo: string; image: WordImage | null };

const MIN_CARDS = 10; // fewer than this after the retries counts as a failed deck
const REVIEW_MAX = CARDS_PER_DECK;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const learner = (d: { targetLanguage?: string; nativeLanguage?: string; level?: string }): Learner => ({
  targetLanguage: d.targetLanguage ?? 'Spanish',
  nativeLanguage: d.nativeLanguage ?? 'English',
  level: d.level ?? 'Beginner',
});

function parseJson(text: string): any | null {
  const cleaned = text.replace(/```json|```/g, '');
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { return null; }
}

/** The AI's cards, trimmed. Cards without a term or a translation are dropped. */
function parseCards(j: any): Omit<StoredCard, 'image'>[] {
  if (!Array.isArray(j?.cards)) return [];
  return j.cards
    .map((c: any) => ({
      term: str(c?.term, 80),
      translation: str(c?.translation, 80),
      example: str(c?.example, 240),
      exampleTranslation: str(c?.exampleTranslation, 240),
      photo: str(c?.photo, 60),
    }))
    .filter((c: StoredCard) => c.term && c.translation);
}

const asCards = (raw: unknown): StoredCard[] =>
  Array.isArray(raw) ? (raw as StoredCard[]).filter((c) => c && typeof c.term === 'string') : [];

/** One status per card; anything unexpected becomes "new". */
export function cleanStatus(raw: unknown, n: number): Status[] {
  const a = Array.isArray(raw) ? raw : [];
  return Array.from({ length: n }, (_, i) => (a[i] === 'learning' || a[i] === 'known' ? a[i] : 'new'));
}
const cleanFlags = (raw: unknown, n: number): boolean[] => {
  const a = Array.isArray(raw) ? raw : [];
  return Array.from({ length: n }, (_, i) => a[i] === true);
};

@Injectable()
export class FlashcardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
    private readonly images: WordImageService,
  ) {}

  private async language(userId: string) {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    return p?.language ?? 'Spanish';
  }

  /** The topic grid: a cover photo per topic and how many cards the learner already knows. */
  async topics(userId: string) {
    const language = await this.language(userId);
    const rows = await this.prisma.flashcardDeck.findMany({ where: { userId, language } });
    const byId = new Map(rows.map((r) => [r.topicId, r]));
    const covers = await Promise.all(FLASH_TOPICS.map((t) => this.images.search(`flash-cover:${t.id}`, t.photo)));

    let reviewCount = 0;
    const topics = FLASH_TOPICS.map((t, i) => {
      const r = byId.get(t.id);
      const total = r ? asCards(r.cards).length || CARDS_PER_DECK : CARDS_PER_DECK;
      const status = cleanStatus(r?.status, total);
      const flags = cleanFlags(r?.flagged, total);
      reviewCount += status.filter((s, k) => s === 'learning' || flags[k]).length;
      const known = status.filter((s) => s === 'known').length;
      return { id: t.id, title: t.title, emoji: t.emoji, total, known, completed: !!r && known === total, cover: covers[i]?.url ?? null };
    });
    return { language, reviewCount: Math.min(reviewCount, REVIEW_MAX), topics };
  }

  /** Open a deck: the saved one, or write a new one with the AI (and find a photo for every card). */
  async deck(userId: string, dto: FlashDeckDto) {
    const topic = findTopic(dto.topicId);
    if (!topic) throw new NotFoundException('Unknown topic.');
    const l = learner(dto);
    const where = { userId_topicId_language: { userId, topicId: topic.id, language: l.targetLanguage } };

    const row = await this.prisma.flashcardDeck.findUnique({ where });
    const saved = row && !dto.restart ? asCards(row.cards) : [];
    if (row && saved.length > 0) {
      return this.view(topic.id, topic.title, saved.map((c, i) => this.card(c, topic.id, i, cleanStatus(row.status, saved.length), cleanFlags(row.flagged, saved.length))));
    }

    const written = await this.generate(topic, l);
    const withImages: StoredCard[] = await Promise.all(
      written.map(async (c) => ({ ...c, image: await this.images.search(`flash:${c.photo.toLowerCase()}`, c.photo || c.term) })),
    );
    const data = {
      cards: withImages as unknown as Prisma.InputJsonValue,
      status: withImages.map(() => 'new') as Prisma.InputJsonValue,
      flagged: withImages.map(() => false) as Prisma.InputJsonValue,
    };
    await this.prisma.flashcardDeck.upsert({
      where,
      create: { userId, topicId: topic.id, language: l.targetLanguage, ...data },
      update: data,
    });
    const status = cleanStatus([], withImages.length);
    const flags = cleanFlags([], withImages.length);
    return this.view(topic.id, topic.title, withImages.map((c, i) => this.card(c, topic.id, i, status, flags)));
  }

  /** The Daily review: cards marked Learning or flagged, from every deck in the language being learned. */
  async review(userId: string) {
    const language = await this.language(userId);
    const rows = await this.prisma.flashcardDeck.findMany({ where: { userId, language } });
    const byId = new Map(rows.map((r) => [r.topicId, r]));
    const cards: ReturnType<FlashcardService['card']>[] = [];
    for (const t of FLASH_TOPICS) {
      const r = byId.get(t.id);
      if (!r) continue;
      const all = asCards(r.cards);
      const status = cleanStatus(r.status, all.length);
      const flags = cleanFlags(r.flagged, all.length);
      all.forEach((c, i) => {
        if ((status[i] === 'learning' || flags[i]) && cards.length < REVIEW_MAX) cards.push(this.card(c, t.id, i, status, flags));
      });
    }
    return { ...this.view('review', 'Daily review', cards), language };
  }

  /** Save one card's "Learning" / "I know it" / flag. Marking a card known also clears its flag, unless the flag is set in the same call. */
  async mark(userId: string, dto: FlashMarkDto) {
    const where = { userId_topicId_language: { userId, topicId: dto.topicId, language: dto.language } };
    const row = await this.prisma.flashcardDeck.findUnique({ where });
    if (!row) return { ok: true };
    const n = asCards(row.cards).length;
    if (dto.index >= n) return { ok: true };
    const status = cleanStatus(row.status, n);
    const flags = cleanFlags(row.flagged, n);
    if (dto.status) {
      status[dto.index] = dto.status;
      if (dto.status === 'known' && dto.flagged === undefined) flags[dto.index] = false;
    }
    if (dto.flagged !== undefined) flags[dto.index] = dto.flagged;
    await this.prisma.flashcardDeck.update({
      where,
      data: { status: status as Prisma.InputJsonValue, flagged: flags as Prisma.InputJsonValue },
    });
    return { ok: true };
  }

  /** Finish a run through a deck: +10 XP and a line in the daily feedback, like the other modes. */
  async complete(userId: string, dto: FlashCompleteDto) {
    const title = dto.topicId === 'review' ? 'Daily review' : findTopic(dto.topicId)?.title;
    if (!title) throw new NotFoundException('Unknown topic.');
    const known = Math.min(dto.known, dto.total);
    return { progress: await this.progress.practice(userId, `Flashcards: ${title} (${known}/${dto.total} known)`) };
  }

  private card(c: StoredCard, topicId: string, index: number, status: Status[], flags: boolean[]) {
    return {
      topicId, index, term: c.term, translation: c.translation, example: c.example,
      exampleTranslation: c.exampleTranslation, image: c.image ?? null,
      status: status[index] ?? 'new', flagged: flags[index] ?? false,
    };
  }

  private view(topicId: string, title: string, cards: ReturnType<FlashcardService['card']>[]) {
    const topic = findTopic(topicId);
    return { topicId, title, emoji: topic?.emoji ?? '🌳', cards };
  }

  /** Ask the AI for CARDS_PER_DECK cards. Later attempts only ask for what is still missing, so the deck ends with exactly 15. */
  private async generate(topic: FlashTopic, l: Learner): Promise<Omit<StoredCard, 'image'>[]> {
    const cards: Omit<StoredCard, 'image'>[] = [];
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 3 && cards.length < CARDS_PER_DECK; attempt++) {
      const missing = CARDS_PER_DECK - cards.length;
      const text = await this.or.complete(
        [
          { role: 'system', content: deckSystem(topic, l, attempt === 0 ? missing : missing + 2, cards.map((c) => c.term)) },
          { role: 'user', content: 'Generate them now.' },
        ],
        { temperature: 0.6, maxTokens: 2600 },
      );
      for (const c of parseCards(parseJson(text))) {
        const key = c.term.toLowerCase();
        if (!seen.has(key) && cards.length < CARDS_PER_DECK) { seen.add(key); cards.push(c); }
      }
    }
    if (cards.length < MIN_CARDS) throw new BadGatewayException('The AI returned an unreadable deck. Please try again.');
    return cards;
  }
}
