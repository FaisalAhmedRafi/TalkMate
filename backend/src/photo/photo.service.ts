import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { OpenRouterService } from '../ai/openrouter.service';
import { Learner } from '../ai/prompts';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { PASS_SCORE } from '../sentence/sentence.service';
import { findPhoto, PHOTO_UNITS, TOTAL_PHOTOS } from './photo.catalog';
import { PhotoJudgeDto } from './photo.dto';
import { judgeSystem } from './photo.prompts';

export type Judgement = {
  score: number; // 1-5
  summary: string;
  corrections: { original: string; corrected: string; explanation: string }[];
  better: string;
  betterTranslation: string;
  words: { word: string; translation: string }[];
};

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

/** The model's JSON, cleaned. Returns null when there is no usable score or summary. */
function parseJudgement(j: any): Judgement | null {
  const score = Math.round(Number(j?.score));
  const summary = str(j?.summary, 400);
  if (!Number.isFinite(score) || score < 1 || score > 5 || !summary) return null;
  const list = (v: unknown, n: number): any[] => (Array.isArray(v) ? v.slice(0, n) : []);
  return {
    score,
    summary,
    corrections: list(j?.corrections, 3)
      .map((c) => ({ original: str(c?.original, 300), corrected: str(c?.corrected, 300), explanation: str(c?.explanation, 300) }))
      .filter((c) => c.corrected),
    better: str(j?.better, 500),
    betterTranslation: str(j?.betterTranslation, 500),
    words: list(j?.words, 3)
      .map((w) => ({ word: str(w?.word, 60), translation: str(w?.translation, 80) }))
      .filter((w) => w.word),
  };
}

@Injectable()
export class PhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
  ) {}

  /** The star grid with the learner's progress in the language they are learning. */
  async units(userId: string) {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    const language = p?.language ?? 'Spanish';
    const rows = await this.prisma.photoProgress.findMany({
      where: { userId, language },
      select: { photoId: true, passed: true, bestScore: true },
    });
    const byId = new Map(rows.map((r) => [r.photoId, r]));
    return {
      language,
      percent: await this.percent(userId, language),
      passed: rows.filter((r) => r.passed && findPhoto(r.photoId)).length,
      total: TOTAL_PHOTOS,
      units: PHOTO_UNITS.map((u) => ({
        number: u.number,
        photos: u.photos.map((x) => {
          const r = byId.get(x.id);
          return { id: x.id, image: x.image, passed: r?.passed ?? false, bestScore: r?.bestScore ?? 0 };
        }),
      })),
    };
  }

  /** The AI looks at the photo, judges the learner's description and the result is saved (best score, pass, XP). */
  async judge(userId: string, dto: PhotoJudgeDto) {
    const found = findPhoto(dto.photoId);
    if (!found) throw new NotFoundException('Unknown photo.');
    const l = learner(dto);
    const description = dto.description.trim();

    let result: Judgement | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const text = await this.or.complete(
        [
          { role: 'system', content: judgeSystem(l) },
          {
            role: 'user',
            content: [
              { type: 'text', text: `The learner's description of the photo:\n"""\n${description}\n"""` },
              { type: 'image_url', image_url: { url: dto.image } },
            ],
          },
        ],
        { temperature: 0.4, maxTokens: 900 },
      );
      result = parseJudgement(parseJson(text));
    }
    if (!result) throw new BadGatewayException('The AI returned an unreadable answer. Please try again.');

    const passed = result.score >= PASS_SCORE;
    const where = { userId_photoId_language: { userId, photoId: found.id, language: l.targetLanguage } };
    const prev = await this.prisma.photoProgress.findUnique({ where });
    const row = await this.prisma.photoProgress.upsert({
      where,
      create: { userId, photoId: found.id, language: l.targetLanguage, bestScore: result.score, lastScore: result.score, attempts: 1, passed },
      update: {
        bestScore: Math.max(prev?.bestScore ?? 0, result.score),
        lastScore: result.score,
        attempts: { increment: 1 },
        passed: (prev?.passed ?? false) || passed,
      },
    });
    const progress = await this.progress.practice(userId, `Photo Mode: ${description.slice(0, 120)} (${result.score}/5)`);
    return { result, passed, bestScore: row.bestScore, percent: await this.percent(userId, l.targetLanguage), progress };
  }

  private async percent(userId: string, language: string) {
    const rows = await this.prisma.photoProgress.findMany({ where: { userId, language, passed: true }, select: { photoId: true } });
    return Math.round((rows.filter((r) => findPhoto(r.photoId)).length / TOTAL_PHOTOS) * 100);
  }
}
