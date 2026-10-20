import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { OpenRouterService } from '../ai/openrouter.service';
import { Learner } from '../ai/prompts';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { PASS_SCORE } from '../sentence/sentence.service';
import { WordImageService } from '../word/word.images';
import { DIALOGUE_TOPICS, findDialogue, TURNS_PER_DIALOGUE } from './dialogue.catalog';
import { DialogueCompleteDto, DialogueSessionDto } from './dialogue.dto';
import { dialogueSystem } from './dialogue.prompts';

type Turn = { partner: string; partnerTranslation: string; you: string; youTranslation: string };
type Script = { title: string; turns: Turn[] };

const MIN_TURNS = 3; // fewer usable turns than this counts as a failed script
const CACHE_MAX = 300;
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

/** The AI's turns, trimmed. A turn needs both of its lines; the rest is dropped. */
function parseScript(j: any): Script | null {
  if (!Array.isArray(j?.turns)) return null;
  const turns: Turn[] = j.turns
    .map((t: any) => ({
      partner: str(t?.partner, 300),
      partnerTranslation: str(t?.partnerTranslation, 300),
      you: str(t?.you, 300),
      youTranslation: str(t?.youTranslation, 300),
    }))
    .filter((t: Turn) => t.partner && t.you)
    .slice(0, TURNS_PER_DIALOGUE);
  return turns.length >= MIN_TURNS ? { title: str(j?.title, 80), turns } : null;
}

@Injectable()
export class DialogueService {
  /**
   * Scripts are saved in memory per topic and language set, so opening the same dialogue again costs no
   * AI request ("pre-scripted"). They are not personal. Lost on restart; "New dialogue" bypasses it.
   */
  private readonly scripts = new Map<string, Script>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
    private readonly images: WordImageService,
  ) {}

  /** The topic grid: a cover photo per topic (an emoji on the client when there is none) and the learner's progress. */
  async topics(userId: string) {
    const [rows, covers] = await Promise.all([
      this.prisma.dialogueProgress.findMany({ where: { userId } }),
      Promise.all(DIALOGUE_TOPICS.map((t) => this.images.search(`dialogue-cover:${t.id}`, t.photo))),
    ]);
    const byId = new Map(rows.map((r) => [r.topicId, r]));
    const passed = rows.filter((r) => r.passed && findDialogue(r.topicId)).length;
    return {
      percent: Math.round((passed / DIALOGUE_TOPICS.length) * 100),
      passed,
      total: DIALOGUE_TOPICS.length,
      topics: DIALOGUE_TOPICS.map((t, i) => {
        const r = byId.get(t.id);
        return {
          id: t.id, title: t.title, emoji: t.emoji, partner: t.partner, partnerEmoji: t.partnerEmoji,
          cover: covers[i]?.url ?? null,
          passed: r?.passed ?? false, bestScore: r?.bestScore ?? 0, attempts: r?.attempts ?? 0,
        };
      }),
    };
  }

  /** One scripted dialogue: the partner speaks, then the learner answers, a few times. */
  async session(dto: DialogueSessionDto) {
    const topic = findDialogue(dto.topicId);
    if (!topic) throw new NotFoundException('Unknown dialogue.');
    const l = learner(dto);
    const key = `${topic.id}:${l.targetLanguage}:${l.nativeLanguage}:${l.level}`;

    let script = dto.fresh ? undefined : this.scripts.get(key);
    if (!script) {
      script = await this.generate(topic.id, l);
      if (this.scripts.size >= CACHE_MAX) this.scripts.delete(this.scripts.keys().next().value as string);
      this.scripts.set(key, script);
    }
    return {
      topicId: topic.id,
      title: topic.title,
      partner: { role: topic.partner, emoji: topic.partnerEmoji },
      turns: script.turns,
    };
  }

  /** Finish a dialogue: keep the best score and whether it was passed, then +10 XP and a line in the daily feedback. */
  async complete(userId: string, dto: DialogueCompleteDto) {
    const topic = findDialogue(dto.topicId);
    if (!topic) throw new NotFoundException('Unknown dialogue.');
    const average = round1(dto.scores.reduce((a, b) => a + b, 0) / dto.scores.length);
    const passed = average >= PASS_SCORE;

    const where = { userId_topicId: { userId, topicId: topic.id } };
    const prev = await this.prisma.dialogueProgress.findUnique({ where });
    await this.prisma.dialogueProgress.upsert({
      where,
      create: { userId, topicId: topic.id, bestScore: average, lastScore: average, attempts: 1, passed },
      update: {
        bestScore: Math.max(prev?.bestScore ?? 0, average),
        lastScore: average,
        attempts: { increment: 1 },
        passed: (prev?.passed ?? false) || passed, // once passed, it stays passed
      },
    });

    const progress = await this.progress.practice(userId, `Dialogue Mode: ${topic.title} (${average}/5)`);
    return { average, passed, percent: (await this.topics(userId)).percent, progress };
  }

  private async generate(topicId: string, l: Learner): Promise<Script> {
    const topic = findDialogue(topicId)!;
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [
          { role: 'system', content: dialogueSystem(topic, l) },
          { role: 'user', content: 'Write the conversation now.' },
        ],
        { temperature: 0.7, maxTokens: 1600 },
      );
      const script = parseScript(parseJson(text));
      if (script) return script;
    }
    throw new BadGatewayException('The AI returned an unreadable dialogue. Please try again.');
  }
}
