import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { ChatFeedbackDto, ChatReplyDto, ChatSaveDto, ChatStartDto, ChatSuggestDto, ChatTranslateDto } from './chat.dto';
import { feedbackSystem, openingSystem, replySystem, suggestionsSystem, translateSystem } from './chat.prompts';

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

type Row = { id: string; tutor: string; messages: unknown; reviews: unknown; translations: unknown };
const shape = (r: Row) => ({
  id: r.id,
  tutor: r.tutor,
  messages: Array.isArray(r.messages) ? r.messages : [],
  reviews: r.reviews ?? {},
  translations: r.translations ?? {},
});

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
  ) {}

  // ---------- AI ----------

  /** The tutor's greeting for a new chat. One AI request. */
  async start(dto: ChatStartDto) {
    const text = await this.or.complete(
      [
        { role: 'system', content: openingSystem(dto.tutor, learner(dto)) },
        { role: 'user', content: 'Send your first message now.' },
      ],
      { temperature: 0.8, maxTokens: 200 },
    );
    const opening = clean(text);
    if (!opening) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { opening };
  }

  /** The tutor's answer to the learner's latest message (+10 XP, like every practice message). */
  async reply(userId: string, dto: ChatReplyDto) {
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException("The last message must be the learner's.");
    const text = await this.or.complete(
      [{ role: 'system', content: replySystem(dto.tutor, learner(dto)) }, ...dto.messages],
      { temperature: 0.8, maxTokens: 350 },
    );
    const reply = clean(text);
    if (!reply) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    await this.progress.practice(userId, last.content);
    return { reply };
  }

  /** Three tappable replies for the suggestion bar. A failure just means no bar, so it never throws on bad JSON. */
  async suggestions(dto: ChatSuggestDto) {
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'assistant') throw new BadRequestException("The last message must be the tutor's.");
    const transcript = dto.messages.slice(-6).map((m) => `${m.role === 'user' ? 'Learner' : dto.tutor}: ${m.content}`).join('\n');
    const text = await this.or.complete(
      [{ role: 'system', content: suggestionsSystem(learner(dto)) }, { role: 'user', content: `${transcript}\n\nGive the 3 suggestions now.` }],
      { temperature: 0.8, maxTokens: 200 },
    );
    const j = parseJson(text);
    const list: string[] = Array.isArray(j?.suggestions)
      ? j.suggestions.map((s: unknown) => str(s, 60)).filter(Boolean).slice(0, 3)
      : [];
    return { suggestions: list };
  }

  /** Mistakes check + translation for one learner message (the right-hand panel). One AI request. */
  async feedback(dto: ChatFeedbackDto) {
    const l = learner(dto);
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: feedbackSystem(l) }, { role: 'user', content: dto.message }],
        { temperature: 0.3, maxTokens: 500 },
      );
      const j = parseJson(text);
      if (j && typeof j.correct === 'boolean') {
        return {
          correct: j.correct,
          corrected: j.correct ? '' : str(j.corrected, 1000),
          explanation: str(j.explanation, 400),
          translation: str(j.translation, 1000),
        };
      }
    }
    throw new BadGatewayException('The AI returned an unreadable review. Please try again.');
  }

  /** One message into the learner's native language (the translate button on the tutor's bubbles). */
  async translate(dto: ChatTranslateDto) {
    const text = await this.or.complete(
      [{ role: 'system', content: translateSystem(learner(dto)) }, { role: 'user', content: dto.text }],
      { temperature: 0.2, maxTokens: 500 },
    );
    const translation = clean(text);
    if (!translation) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { translation };
  }

  // ---------- saved chats ----------

  /** The open chat for the learner's current target language, or { session: null }. */
  async session(userId: string) {
    const row = await this.current(userId, await this.language(userId));
    return { session: row && Array.isArray(row.messages) && row.messages.length > 0 ? shape(row) : null };
  }

  /** Saves the open chat (the client sends it after every change). Creates it on the first learner message. */
  async save(userId: string, dto: ChatSaveDto) {
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
    const row = await this.current(userId, language);
    if (row) {
      await this.prisma.chatSession.update({ where: { id: row.id }, data: { tutor: dto.tutor, messages, reviews, translations, count } });
    } else {
      await this.prisma.chatSession.create({ data: { userId, language, tutor: dto.tutor, messages, reviews, translations, count } });
    }
    return { ok: true };
  }

  /** "Start a new chat": the open chat moves to the history. */
  async archive(userId: string) {
    const row = await this.current(userId, await this.language(userId));
    if (row) await this.prisma.chatSession.update({ where: { id: row.id }, data: { archived: true } });
    return { ok: true };
  }

  /** The Chat history list: every archived chat in the current target language, newest first. */
  async history(userId: string) {
    const rows = await this.prisma.chatSession.findMany({
      where: { userId, language: await this.language(userId), archived: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return {
      chats: rows.map((r) => {
        const messages = Array.isArray(r.messages) ? (r.messages as any[]) : [];
        const first = messages.find((m) => m?.role === 'user') ?? messages[0];
        return { id: r.id, tutor: r.tutor, title: str(first?.content, 80), count: r.count, updatedAt: r.updatedAt.toISOString() };
      }),
    };
  }

  /** Opens an old chat: the open chat moves to the history and this one becomes the open chat. */
  async open(userId: string, id: string) {
    const row = await this.prisma.chatSession.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Chat not found.');
    if (row.archived) {
      await this.prisma.$transaction([
        this.prisma.chatSession.updateMany({ where: { userId, language: row.language, archived: false }, data: { archived: true } }),
        this.prisma.chatSession.update({ where: { id: row.id }, data: { archived: false } }),
      ]);
    }
    return { session: shape(row) };
  }

  async remove(userId: string, id: string) {
    await this.prisma.chatSession.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  private current(userId: string, language: string) {
    return this.prisma.chatSession.findFirst({ where: { userId, language, archived: false }, orderBy: { updatedAt: 'desc' } });
  }

  /** The learner's current target language: chats are kept per language, like the other modes. */
  private async language(userId: string): Promise<string> {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    return p?.language ?? 'Spanish';
  }
}
