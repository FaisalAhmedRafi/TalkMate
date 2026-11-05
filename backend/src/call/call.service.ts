import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { CallAdvancedDto, CallFeedbackDto, CallReplyDto, CallSaveDto, CallStartDto, CallTranslateDto } from './call.dto';
import { advancedSystem, DEFAULT_TUTOR, feedbackSystem, openingSystem, replySystem, translateSystem } from './call.prompts';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown, max: number, len: number): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : [];

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

/** Models sometimes wrap a spoken line in quotes; the caption should not show them. */
const clean = (text: string) => text.trim().replace(/^["“„«]+|["”“»]+$/g, '').trim();

type Row = { id: string; tutor: string; messages: unknown; reviews: unknown; translations: unknown; seconds: number };
const shape = (r: Row) => ({
  id: r.id,
  tutor: r.tutor,
  messages: Array.isArray(r.messages) ? r.messages : [],
  reviews: r.reviews ?? {},
  translations: r.translations ?? {},
  seconds: r.seconds,
});

/** Call Mode: a voice call with an AI tutor (Emma, Kai, Nina or Niko). The call is saved after every change, and finished calls form the Call history. */
@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
  ) {}

  /** The tutor's first line when the call connects. */
  async start(userId: string, dto: CallStartDto) {
    const l = learner(dto);
    const tutor = dto.tutor ?? DEFAULT_TUTOR;
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [{ role: 'system', content: openingSystem(l, name, tutor) }, { role: 'user', content: 'Say your first line now.' }],
      { temperature: 0.7, maxTokens: 200 },
    );
    const opening = clean(text);
    if (!opening) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { teacher: { name: tutor }, opening };
  }

  /** The tutor's answer to the learner's latest message. Awards the same +10 XP as a Chat message. */
  async reply(userId: string, dto: CallReplyDto) {
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException('The last message must be the learner\'s.');
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [{ role: 'system', content: replySystem(learner(dto), name, dto.tutor ?? DEFAULT_TUTOR) }, ...dto.messages],
      { temperature: 0.8, maxTokens: 250 },
    );
    const reply = clean(text);
    if (!reply) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    await this.progress.practice(userId, `Call: ${last.content}`);
    return { reply };
  }

  /** Mistakes check for one spoken message (the right-hand panel). One AI request. */
  async feedback(dto: CallFeedbackDto) {
    const l = learner(dto);
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: feedbackSystem(l) }, { role: 'user', content: dto.message }],
        { temperature: 0.3, maxTokens: 400 },
      );
      const j = parseJson(text);
      if (j && typeof j.correct === 'boolean') {
        return { correct: j.correct, corrected: j.correct ? '' : str(j.corrected, 1000), explanation: str(j.explanation, 500) };
      }
    }
    throw new BadGatewayException('The AI returned an unreadable review. Please try again.');
  }

  /** One of the tutor's lines into the learner's native language (the translate button). */
  async translate(dto: CallTranslateDto) {
    const text = await this.or.complete(
      [{ role: 'system', content: translateSystem(learner(dto)) }, { role: 'user', content: dto.text }],
      { temperature: 0.2, maxTokens: 400 },
    );
    const translation = clean(text);
    if (!translation) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { translation };
  }

  /** "Advanced feedback": a review of the whole call so far. One AI request. */
  async advanced(dto: CallAdvancedDto) {
    if (!dto.messages.some((m) => m.role === 'user')) throw new BadRequestException('Say something first, then ask for feedback.');
    const tutor = dto.tutor ?? DEFAULT_TUTOR;
    const transcript = dto.messages.map((m) => `${m.role === 'user' ? 'Learner' : tutor}: ${m.content}`).join('\n');
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: advancedSystem(learner(dto), tutor) }, { role: 'user', content: transcript }],
        { temperature: 0.4, maxTokens: 900 },
      );
      const j = parseJson(text);
      if (j && typeof j.summary === 'string') {
        return {
          summary: str(j.summary, 600),
          strengths: list(j.strengths, 3, 300),
          mistakes: (Array.isArray(j.mistakes) ? j.mistakes : []).slice(0, 5)
            .map((m: any) => ({ original: str(m?.original, 300), corrected: str(m?.corrected, 300), explanation: str(m?.explanation, 400) }))
            .filter((m: { original: string; corrected: string }) => m.original && m.corrected),
          tips: list(j.tips, 3, 300),
        };
      }
    }
    throw new BadGatewayException('The AI returned an unreadable review. Please try again.');
  }

  // ---------- saved calls ----------

  /** The open call for the learner's current target language, or { session: null }. */
  async session(userId: string) {
    const row = await this.current(userId, await this.language(userId));
    return { session: row && Array.isArray(row.messages) && row.messages.length > 0 ? shape(row) : null };
  }

  /** Saves the open call (the client sends it after every change). Creates it on the first thing the learner says. */
  async save(userId: string, dto: CallSaveDto) {
    const language = await this.language(userId);
    const messages = dto.messages.map((m) => ({ role: m.role, content: m.content }));
    const reviews: Record<string, any> = {};
    const translations: Record<string, string> = {};
    for (const [k, v] of Object.entries(dto.reviews ?? {})) {
      const i = Number(k);
      const r: any = v;
      if (!Number.isInteger(i) || i < 0 || i >= messages.length || messages[i].role !== 'user' || typeof r?.correct !== 'boolean') continue;
      reviews[i] = { correct: r.correct, corrected: str(r.corrected, 1000), explanation: str(r.explanation, 500) };
    }
    for (const [k, v] of Object.entries(dto.translations ?? {})) {
      const i = Number(k);
      const t = str((v as any)?.text ?? v, 2000);
      if (Number.isInteger(i) && i >= 0 && i < messages.length && messages[i].role === 'assistant' && t) translations[i] = t;
    }
    const count = messages.filter((m) => m.role === 'user').length;
    const row = await this.current(userId, language);
    if (row) {
      await this.prisma.callSession.update({ where: { id: row.id }, data: { tutor: dto.tutor, messages, reviews, translations, count, seconds: dto.seconds } });
    } else {
      await this.prisma.callSession.create({ data: { userId, language, tutor: dto.tutor, messages, reviews, translations, count, seconds: dto.seconds } });
    }
    return { ok: true };
  }

  /** "Start a new call": the open call moves to the history. */
  async archive(userId: string) {
    const row = await this.current(userId, await this.language(userId));
    if (row) await this.prisma.callSession.update({ where: { id: row.id }, data: { archived: true } });
    return { ok: true };
  }

  /** The Call history list: every archived call in the current target language, newest first. */
  async history(userId: string) {
    const rows = await this.prisma.callSession.findMany({
      where: { userId, language: await this.language(userId), archived: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return {
      calls: rows.map((r) => {
        const messages = Array.isArray(r.messages) ? (r.messages as any[]) : [];
        const first = messages.find((m) => m?.role === 'user') ?? messages[0];
        return { id: r.id, tutor: r.tutor, title: str(first?.content, 80), count: r.count, seconds: r.seconds, updatedAt: r.updatedAt.toISOString() };
      }),
    };
  }

  /** Opens an old call: the open call moves to the history and this one becomes the open call. */
  async open(userId: string, id: string) {
    const row = await this.prisma.callSession.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Call not found.');
    if (row.archived) {
      await this.prisma.$transaction([
        this.prisma.callSession.updateMany({ where: { userId, language: row.language, archived: false }, data: { archived: true } }),
        this.prisma.callSession.update({ where: { id: row.id }, data: { archived: false } }),
      ]);
    }
    return { session: shape(row) };
  }

  async remove(userId: string, id: string) {
    await this.prisma.callSession.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  private current(userId: string, language: string) {
    return this.prisma.callSession.findFirst({ where: { userId, language, archived: false }, orderBy: { updatedAt: 'desc' } });
  }

  /** The learner's current target language: calls are kept per language, like the other modes. */
  private async language(userId: string): Promise<string> {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    return p?.language ?? 'Spanish';
  }

  /** What the tutor calls the learner: the account name, else the first part of the email. */
  private async displayName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const raw = u?.name?.trim() || (u?.email ?? '').split('@')[0].replace(/[._\-+]+/g, ' ').replace(/\d+/g, '').trim();
    const first = raw.split(/\s+/)[0] ?? '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1, 40) : 'there';
  }
}
