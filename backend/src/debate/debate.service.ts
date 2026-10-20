import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { WordImageService } from '../word/word.images';
import { DEBATE_TOPICS, DebateSide, findDebate, TEACHER } from './debate.catalog';
import { DebateFeedbackDto, DebateReplyDto, DebateSaveDto, DebateSessionQueryDto, DebateStartDto, DebateTranslateDto } from './debate.dto';
import { feedbackSystem, openingSystem, replySystem, translateSystem } from './debate.prompts';

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

/** Models sometimes wrap a plain reply in quotes; the chat bubble should not show them. */
const clean = (text: string) => text.trim().replace(/^["“„«]+|["”“»]+$/g, '').trim();

@Injectable()
export class DebateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
    private readonly images: WordImageService,
  ) {}

  /** The topic grid: a cover photo per topic (an emoji on the client when there is none) and which topics the learner has debated. */
  async topics(userId: string) {
    const language = await this.language(userId);
    const [rows, covers] = await Promise.all([
      this.prisma.debateSession.findMany({ where: { userId, language }, select: { topicId: true, side: true, count: true } }),
      Promise.all(DEBATE_TOPICS.map((t) => this.images.search(`debate-cover:${t.id}`, t.photo))),
    ]);
    return {
      total: DEBATE_TOPICS.length,
      debated: new Set(rows.filter((r) => r.count > 0 && findDebate(r.topicId)).map((r) => r.topicId)).size,
      topics: DEBATE_TOPICS.map((t, i) => {
        const mine = rows.filter((r) => r.topicId === t.id);
        const n = (side: string) => mine.find((r) => r.side === side)?.count ?? 0;
        return {
          id: t.id, title: t.title, statement: t.statement, emoji: t.emoji, cover: covers[i]?.url ?? null,
          debated: mine.some((r) => r.count > 0),
          saved: { for: n('for'), against: n('against') }, // learner messages in the unfinished debate on each side
        };
      }),
    };
  }

  /** The saved debate for a topic and side, or { session: null }. */
  async session(userId: string, q: DebateSessionQueryDto) {
    const topic = this.topic(q.topicId);
    const language = await this.language(userId);
    const row = await this.prisma.debateSession.findUnique({
      where: { userId_topicId_side_language: { userId, topicId: topic.id, side: q.side, language } },
    });
    const messages = Array.isArray(row?.messages) ? (row!.messages as any[]) : [];
    if (!row || messages.length === 0) return { session: null };
    return {
      session: {
        intro: { topicId: topic.id, title: topic.title, statement: topic.statement, side: q.side, teacher: TEACHER, opening: str(messages[0]?.content, 2000) },
        messages,
        reviews: row.reviews ?? {},
        translations: row.translations ?? {},
      },
    };
  }

  /** Saves the whole conversation (the client sends it after every change). Messages count as practice only through /debate/reply. */
  async save(userId: string, dto: DebateSaveDto) {
    const topic = this.topic(dto.topicId);
    const language = await this.language(userId);
    const messages = dto.messages.map((m) => ({ role: m.role, content: m.content }));
    const reviews: Record<string, any> = {};
    const translations: Record<string, string> = {};
    for (const [k, v] of Object.entries(dto.reviews ?? {})) {
      const i = Number(k);
      const r: any = v;
      if (!Number.isInteger(i) || i < 0 || i >= messages.length || messages[i].role !== 'user' || typeof r?.correct !== 'boolean') continue;
      reviews[i] = { correct: r.correct, corrected: str(r.corrected, 1000), explanation: str(r.explanation, 400), translation: str(r.translation, 1000) };
    }
    for (const [k, v] of Object.entries(dto.translations ?? {})) {
      const i = Number(k);
      const t = str((v as any)?.text ?? v, 2000);
      if (Number.isInteger(i) && i >= 0 && i < messages.length && messages[i].role === 'assistant' && t) translations[i] = t;
    }
    const count = messages.filter((m) => m.role === 'user').length;
    const where = { userId_topicId_side_language: { userId, topicId: topic.id, side: dto.side, language } };
    await this.prisma.debateSession.upsert({
      where,
      create: { userId, topicId: topic.id, side: dto.side, language, messages, reviews, translations, count },
      update: { messages, reviews, translations, count },
    });
    return { ok: true };
  }

  /** Throws the saved debate away ("Start over", "Restart debate"). */
  async clear(userId: string, q: DebateSessionQueryDto) {
    const topic = this.topic(q.topicId);
    const language = await this.language(userId);
    await this.prisma.debateSession.deleteMany({ where: { userId, topicId: topic.id, side: q.side, language } });
    return { ok: true };
  }

  /** Opens a debate: the teacher greets the learner by name and says they disagree. One AI request. */
  async start(userId: string, dto: DebateStartDto) {
    const topic = this.topic(dto.topicId);
    const l = learner(dto);
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [
        { role: 'system', content: openingSystem(topic, dto.side, l, name) },
        { role: 'user', content: 'Write the first message now.' },
      ],
      { temperature: 0.7, maxTokens: 300 },
    );
    const opening = clean(text);
    if (!opening) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { topicId: topic.id, title: topic.title, statement: topic.statement, side: dto.side, teacher: TEACHER, opening };
  }

  /** The teacher's answer to the learner's latest message. Awards the same +10 XP as a Chat message. */
  async reply(userId: string, dto: DebateReplyDto) {
    const topic = this.topic(dto.topicId);
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException('The last message must be the learner\'s.');
    const l = learner(dto);
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [{ role: 'system', content: replySystem(topic, dto.side, l, name) }, ...dto.messages],
      { temperature: 0.8, maxTokens: 350 },
    );
    const reply = clean(text);
    if (!reply) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    await this.progress.practice(userId, `Debate: ${topic.title} - ${last.content}`);
    return { reply };
  }

  /** Mistakes check + translation for one learner message (the right-hand panel). One AI request. */
  async feedback(dto: DebateFeedbackDto) {
    const l = learner(dto);
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: feedbackSystem(l) }, { role: 'user', content: dto.message }],
        { temperature: 0.3, maxTokens: 500 },
      );
      const j = parseJson(text);
      if (j && typeof j.correct === 'boolean') {
        const corrected = str(j.corrected, 1000);
        return {
          // a message the AI calls wrong but could not fix is still shown as a warning, with its explanation
          correct: j.correct,
          corrected: j.correct ? '' : corrected,
          explanation: str(j.explanation, 400),
          translation: str(j.translation, 1000),
        };
      }
    }
    throw new BadGatewayException('The AI returned an unreadable review. Please try again.');
  }

  /** One message into the learner's native language (the translate button on the teacher's bubbles). */
  async translate(dto: DebateTranslateDto) {
    const text = await this.or.complete(
      [{ role: 'system', content: translateSystem(learner(dto)) }, { role: 'user', content: dto.text }],
      { temperature: 0.2, maxTokens: 500 },
    );
    const translation = clean(text);
    if (!translation) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { translation };
  }

  /** The learner's current target language: saved debates are kept per language, like Word Mode lessons. */
  private async language(userId: string): Promise<string> {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    return p?.language ?? 'Spanish';
  }

  private topic(id: string) {
    const t = findDebate(id);
    if (!t) throw new NotFoundException('Unknown debate topic.');
    return t;
  }

  /** What the teacher calls the learner: the account name, else the first part of the email. */
  private async displayName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const raw = u?.name?.trim() || (u?.email ?? '').split('@')[0].replace(/[._\-+]+/g, ' ').replace(/\d+/g, '').trim();
    const first = raw.split(/\s+/)[0] ?? '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1, 40) : 'there';
  }
}
