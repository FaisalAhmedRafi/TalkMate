import { BadGatewayException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { findSkill, SENTENCE_UNITS, TOTAL_SKILLS } from './sentence.catalog';
import { CompleteDto, EvaluateDto, SessionDto } from './sentence.dto';
import { evaluateSystem, SENTENCES_PER_SESSION, sessionSystem } from './sentence.prompts';
import { anchorScore, clampScore, matchSpeech } from './sentence.scoring';

/** A skill counts as passed when the average score of a finished session is at least this. */
export const PASS_SCORE = 3;
const round1 = (n: number) => Math.round(n * 10) / 10;

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

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

@Injectable()
export class SentenceService {
  private readonly log = new Logger(SentenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
  ) {}

  /** Unit list with the learner's progress on each skill. */
  async units(userId: string) {
    const rows = await this.prisma.sentenceProgress.findMany({ where: { userId } });
    const byId = new Map(rows.map((r) => [r.skillId, r]));
    const passed = rows.filter((r) => r.passed && findSkill(r.skillId)).length;
    return {
      percent: Math.round((passed / TOTAL_SKILLS) * 100),
      passed,
      total: TOTAL_SKILLS,
      units: SENTENCE_UNITS.map((u) => ({
        number: u.number,
        title: u.title,
        skills: u.skills.map((k) => {
          const r = byId.get(k.id);
          return { ...k, passed: r?.passed ?? false, bestScore: r?.bestScore ?? 0, attempts: r?.attempts ?? 0 };
        }),
      })),
    };
  }

  /** Ask the AI for 5 sentences that fit the chosen skill. */
  async session(dto: SessionDto) {
    const found = findSkill(dto.skillId);
    if (!found) throw new NotFoundException('Unknown skill.');
    const system = sessionSystem(found.unit, found.skill, learner(dto));

    let best: { sentence: string; translation: string; note: string }[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: system }, { role: 'user', content: 'Generate it now.' }],
        { temperature: 0.8, maxTokens: 1200 },
      );
      const raw = parseJson(text)?.items;
      if (!Array.isArray(raw)) continue;
      const seen = new Set<string>();
      const items = raw
        .map((i: any) => ({ sentence: str(i?.sentence, 300), translation: str(i?.translation, 300), note: str(i?.note, 300) }))
        .filter((i) => i.sentence && !seen.has(i.sentence.toLowerCase()) && !!seen.add(i.sentence.toLowerCase()))
        .slice(0, SENTENCES_PER_SESSION);
      if (items.length > best.length) best = items;
      if (best.length === SENTENCES_PER_SESSION) break;
    }
    // Free models sometimes return fewer than asked; 3 or more is still a usable session.
    if (best.length < 3) throw new BadGatewayException('The AI returned an unreadable answer. Please try again.');
    return { skillId: found.skill.id, title: found.skill.title, items: best };
  }

  /** Rate how well the learner said a sentence, from 1 to 5. */
  async evaluate(dto: EvaluateDto) {
    const l = learner(dto);
    const m = matchSpeech(l.targetLanguage, dto.sentence, dto.transcript);
    const anchor = anchorScore(m.similarity, dto.confidence);
    const base = { heard: dto.transcript, similarity: Math.round(m.similarity * 100) / 100, spaced: m.spaced, words: m.words };

    try {
      const text = await this.or.complete(
        [
          { role: 'system', content: evaluateSystem(l) },
          {
            role: 'user',
            content:
              `target: ${dto.sentence}\nheard: ${dto.transcript}\n` +
              `word match: ${Math.round(m.similarity * 100)}%` +
              (typeof dto.confidence === 'number' ? `\nrecogniser confidence: ${Math.round(dto.confidence * 100)}%` : '') +
              (m.missed.length ? `\nwords not heard: ${m.missed.join(', ')}` : ''),
          },
        ],
        { temperature: 0.3, maxTokens: 300 },
      );
      const j = parseJson(text);
      const n = Number(j?.score);
      if (Number.isFinite(n)) {
        return { ...base, score: clampScore(n, anchor), feedback: str(j.feedback, 400), tip: str(j.tip, 400), source: 'ai' as const };
      }
      this.log.warn('Unreadable pronunciation feedback; using the match score.');
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e; // missing API key: tell the user
      this.log.warn(`AI feedback failed: ${(e as Error).message}`);
    }

    const FALLBACK = ['', 'Not quite. Listen again and try once more.', 'Getting there. Listen again and slow down a little.',
      'Good effort. A few words were unclear.', 'Very good. Nearly perfect.', 'Excellent! That sounded clear and accurate.'];
    return {
      ...base, score: anchor, feedback: FALLBACK[anchor],
      tip: m.missed.length && anchor < 5 ? `Practise: ${m.missed.slice(0, 4).join(', ')}` : '',
      source: 'fallback' as const,
    };
  }

  /** Save the result of a finished session and award XP the same way the other modes do. */
  async complete(userId: string, dto: CompleteDto) {
    const found = findSkill(dto.skillId);
    if (!found) throw new NotFoundException('Unknown skill.');
    const average = round1(dto.scores.reduce((a, b) => a + b, 0) / dto.scores.length);
    const passed = average >= PASS_SCORE;

    const prev = await this.prisma.sentenceProgress.findUnique({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
    });
    await this.prisma.sentenceProgress.upsert({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
      create: { userId, skillId: dto.skillId, bestScore: average, lastScore: average, attempts: 1, passed },
      update: {
        bestScore: Math.max(prev?.bestScore ?? 0, average),
        lastScore: average,
        attempts: { increment: 1 },
        passed: (prev?.passed ?? false) || passed,
      },
    });

    const progress = await this.progress.practice(userId, `Sentence Mode: ${found.skill.title} (${average}/5)`);
    const { percent } = await this.units(userId);
    return { average, passed, percent, progress };
  }
}
