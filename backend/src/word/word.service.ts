import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OpenRouterService } from '../ai/openrouter.service';
import { Learner } from '../ai/prompts';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { PASS_SCORE } from '../sentence/sentence.service';
import { findWord, TOTAL_WORDS, WORD_UNITS, WordItem, WordUnit } from './word.catalog';
import { WordCompleteDto, WordSaveDto, WordStartDto } from './word.dto';
import { WordImage, WordImageService } from './word.images';
import { lessonSystem, SENTENCES_PER_WORD } from './word.prompts';

export type Chunk = { text: string; meaning: string; explanation: string };
export type LessonSentence = { sentence: string; translation: string; note: string; chunks: Chunk[] };
export type Lesson = { word: string; translation: string; sentences: LessonSentence[] };

const round1 = (n: number) => Math.round(n * 10) / 10;
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

/** One 1-5 score per sentence, or null for skipped / not reached. Anything else becomes null. */
export function cleanScores(raw: unknown, max: number): (number | null)[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, max).map((v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? (v as number) : null));
}

/** The saved lesson JSON, if it still has the expected shape. */
function asLesson(raw: unknown): Lesson | null {
  const l = raw as Lesson | null;
  return l && typeof l.word === 'string' && Array.isArray(l.sentences) && l.sentences.length > 0 ? l : null;
}

function parseLesson(j: any): Lesson | null {
  const word = str(j?.word, 80);
  if (!word || !Array.isArray(j?.sentences)) return null;
  const seen = new Set<string>();
  const sentences: LessonSentence[] = j.sentences
    .map((s: any) => ({
      sentence: str(s?.sentence, 300),
      translation: str(s?.translation, 300),
      note: str(s?.note, 300),
      chunks: (Array.isArray(s?.chunks) ? s.chunks.slice(0, 4) : [])
        .map((c: any) => ({ text: str(c?.text, 150), meaning: str(c?.meaning, 150), explanation: str(c?.explanation, 300) }))
        .filter((c: Chunk) => c.text),
    }))
    .filter((s: LessonSentence) => s.sentence && !seen.has(s.sentence.toLowerCase()) && !!seen.add(s.sentence.toLowerCase()))
    .slice(0, SENTENCES_PER_WORD);
  return { word, translation: str(j?.translation, 120), sentences };
}

@Injectable()
export class WordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
    private readonly images: WordImageService,
  ) {}

  /** The star grid: every unit and word, with the learner's progress in the language they are learning. */
  async units(userId: string) {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    const language = p?.language ?? 'Spanish';
    const rows = await this.prisma.wordProgress.findMany({
      where: { userId, language },
      select: { wordId: true, passed: true, bestScore: true, finished: true },
    });
    const byId = new Map(rows.map((r) => [r.wordId, r]));
    const passed = rows.filter((r) => r.passed && findWord(r.wordId)).length;
    return {
      language,
      percent: Math.round((passed / TOTAL_WORDS) * 100),
      passed,
      total: TOTAL_WORDS,
      units: WORD_UNITS.map((u) => ({
        number: u.number,
        title: u.title,
        words: u.words.map((x) => {
          const r = byId.get(x.id);
          // a lesson row exists once it was opened; it stays "in progress" until the run is finished
          return { id: x.id, emoji: x.emoji, passed: r?.passed ?? false, bestScore: r?.bestScore ?? 0, inProgress: !!r && !r.finished };
        }),
      })),
    };
  }

  /** Open a lesson: resume the saved one, or make a new one with the AI. */
  async start(userId: string, dto: WordStartDto) {
    const found = findWord(dto.wordId);
    if (!found) throw new NotFoundException('Unknown word.');
    const l = learner(dto);
    const where = { userId_wordId_language: { userId, wordId: found.word.id, language: l.targetLanguage } };

    const row = await this.prisma.wordProgress.findUnique({ where });
    const saved = row && !row.finished && !dto.restart ? asLesson(row.lesson) : null;
    if (row && saved) {
      const image = await this.images.find(found.word);
      const n = saved.sentences.length;
      return this.view(found.word, saved, Math.min(row.step, n), cleanScores(row.scores, n), true, image);
    }

    const [lesson, image] = await Promise.all([this.generate(found.word, found.unit, l), this.images.find(found.word)]);
    const data = {
      lesson: lesson as unknown as Prisma.InputJsonValue,
      step: 0,
      scores: [] as Prisma.InputJsonValue,
      finished: false,
    };
    await this.prisma.wordProgress.upsert({
      where,
      create: { userId, wordId: found.word.id, language: l.targetLanguage, ...data },
      update: data,
    });
    return this.view(found.word, lesson, 0, [], false, image);
  }

  /** Remember where the learner is, so "Continue the exercise" can pick up from there. */
  async save(userId: string, dto: WordSaveDto) {
    const where = { userId_wordId_language: { userId, wordId: dto.wordId, language: dto.language } };
    const row = await this.prisma.wordProgress.findUnique({ where });
    if (!row || row.finished) return { ok: true };
    const n = asLesson(row.lesson)?.sentences.length ?? SENTENCES_PER_WORD;
    await this.prisma.wordProgress.update({
      where,
      data: { step: Math.min(dto.step, n), scores: cleanScores(dto.scores, n) as Prisma.InputJsonValue },
    });
    return { ok: true };
  }

  /** Finish a lesson: pass or not, best score, and XP the same way the other modes award it. */
  async complete(userId: string, dto: WordCompleteDto) {
    const found = findWord(dto.wordId);
    if (!found) throw new NotFoundException('Unknown word.');
    const where = { userId_wordId_language: { userId, wordId: dto.wordId, language: dto.language } };
    const prev = await this.prisma.wordProgress.findUnique({ where });
    const n = asLesson(prev?.lesson)?.sentences.length ?? SENTENCES_PER_WORD;
    const scores = cleanScores(dto.scores, n);
    const scored = scores.filter((s): s is number => s !== null);
    const average = scored.length ? round1(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;
    const passed = scored.length > 0 && average >= PASS_SCORE;

    if (scored.length === 0) {
      // every sentence was skipped: close the run, but there is nothing to score or reward
      if (prev) await this.prisma.wordProgress.update({ where, data: { finished: true, step: n, scores: scores as Prisma.InputJsonValue } });
      return { average, passed, percent: await this.percent(userId, dto.language), progress: await this.progress.snapshot(userId) };
    }

    await this.prisma.wordProgress.upsert({
      where,
      create: { userId, wordId: dto.wordId, language: dto.language, step: n, scores: scores as Prisma.InputJsonValue, finished: true, passed, bestScore: average, attempts: 1 },
      update: {
        step: n,
        scores: scores as Prisma.InputJsonValue,
        finished: true,
        passed: (prev?.passed ?? false) || passed,
        bestScore: Math.max(prev?.bestScore ?? 0, average),
        attempts: { increment: 1 },
      },
    });
    const progress = await this.progress.practice(userId, `Word Mode: ${found.word.english} (${average}/5)`);
    return { average, passed, percent: await this.percent(userId, dto.language), progress };
  }

  private async percent(userId: string, language: string) {
    const rows = await this.prisma.wordProgress.findMany({ where: { userId, language, passed: true }, select: { wordId: true } });
    return Math.round((rows.filter((r) => findWord(r.wordId)).length / TOTAL_WORDS) * 100);
  }

  private view(item: WordItem, lesson: Lesson, step: number, scores: (number | null)[], resumed: boolean, image: WordImage | null) {
    return { wordId: item.id, emoji: item.emoji, word: lesson.word, translation: lesson.translation, sentences: lesson.sentences, step, scores, resumed, image };
  }

  /** Ask the AI for the word and its sentences. Two attempts; 2 or more sentences make a usable lesson. */
  private async generate(item: WordItem, unit: WordUnit, l: Learner): Promise<Lesson> {
    const system = lessonSystem(item, unit, l);
    let best: Lesson | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: system }, { role: 'user', content: 'Generate it now.' }],
        { temperature: 0.7, maxTokens: 1800 },
      );
      const lesson = parseLesson(parseJson(text));
      if (lesson && (!best || lesson.sentences.length > best.sentences.length)) best = lesson;
      if (best && best.sentences.length === SENTENCES_PER_WORD) break;
    }
    if (!best || best.sentences.length < 2) throw new BadGatewayException('The AI returned an unreadable lesson. Please try again.');
    return best;
  }
}
