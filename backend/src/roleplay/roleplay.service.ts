import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { WordImageService } from '../word/word.images';
import { findRoleplay, RoleplayScenario, ROLEPLAY_SCENARIOS } from './roleplay.catalog';
import { RoleplayFeedbackDto, RoleplayReplyDto, RoleplaySaveDto, RoleplaySessionQueryDto, RoleplayStartDto, RoleplayTranslateDto } from './roleplay.dto';
import { feedbackSystem, openingSystem, replySystem, translateSystem } from './roleplay.prompts';

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

/** What the client needs to show a scenario's intro and chat header. */
const intro = (s: RoleplayScenario) => ({
  scenarioId: s.id, title: s.title, scenario: s.scenario, tasks: s.tasks, partner: { name: s.partner, emoji: s.partnerEmoji },
});

@Injectable()
export class RoleplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
    private readonly images: WordImageService,
  ) {}

  /** The scenario grid: a cover photo per scenario (an emoji on the client when there is none) and which ones the learner has practised. */
  async scenarios(userId: string) {
    const language = await this.language(userId);
    const [rows, covers] = await Promise.all([
      this.prisma.roleplaySession.findMany({ where: { userId, language }, select: { scenarioId: true, count: true } }),
      Promise.all(ROLEPLAY_SCENARIOS.map((s) => this.images.search(`roleplay-cover:${s.id}`, s.photo))),
    ]);
    const saved = new Map(rows.map((r) => [r.scenarioId, r.count]));
    return {
      total: ROLEPLAY_SCENARIOS.length,
      practiced: ROLEPLAY_SCENARIOS.filter((s) => (saved.get(s.id) ?? 0) > 0).length,
      scenarios: ROLEPLAY_SCENARIOS.map((s, i) => ({
        id: s.id, title: s.title, category: s.category, emoji: s.emoji, cover: covers[i]?.url ?? null,
        scenario: s.scenario, tasks: s.tasks, partner: { name: s.partner, emoji: s.partnerEmoji },
        practiced: (saved.get(s.id) ?? 0) > 0,
        saved: saved.get(s.id) ?? 0, // learner messages in the unfinished chat
      })),
    };
  }

  /** The saved chat for a scenario, or { session: null }. */
  async session(userId: string, q: RoleplaySessionQueryDto) {
    const s = this.scenario(q.scenarioId);
    const language = await this.language(userId);
    const row = await this.prisma.roleplaySession.findUnique({
      where: { userId_scenarioId_language: { userId, scenarioId: s.id, language } },
    });
    const messages = Array.isArray(row?.messages) ? (row!.messages as any[]) : [];
    if (!row || messages.length === 0) return { session: null };
    return {
      session: {
        intro: { ...intro(s), opening: str(messages[0]?.content, 2000) },
        messages,
        reviews: row.reviews ?? {},
        translations: row.translations ?? {},
      },
    };
  }

  /** Saves the whole conversation (the client sends it after every change). Messages count as practice only through /roleplay/reply. */
  async save(userId: string, dto: RoleplaySaveDto) {
    const s = this.scenario(dto.scenarioId);
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
    const where = { userId_scenarioId_language: { userId, scenarioId: s.id, language } };
    await this.prisma.roleplaySession.upsert({
      where,
      create: { userId, scenarioId: s.id, language, messages, reviews, translations, count },
      update: { messages, reviews, translations, count },
    });
    return { ok: true };
  }

  /** Throws the saved chat away ("Start over", "Restart roleplay"). */
  async clear(userId: string, q: RoleplaySessionQueryDto) {
    const s = this.scenario(q.scenarioId);
    const language = await this.language(userId);
    await this.prisma.roleplaySession.deleteMany({ where: { userId, scenarioId: s.id, language } });
    return { ok: true };
  }

  /** Opens a scenario: the partner says the first line. One AI request. */
  async start(dto: RoleplayStartDto) {
    const s = this.scenario(dto.scenarioId);
    const text = await this.or.complete(
      [
        { role: 'system', content: openingSystem(s, learner(dto)) },
        { role: 'user', content: 'Say your first line now.' },
      ],
      { temperature: 0.7, maxTokens: 200 },
    );
    const opening = clean(text);
    if (!opening) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { ...intro(s), opening };
  }

  /** The partner's answer to the learner's latest message. Awards the same +10 XP as a Chat message. */
  async reply(userId: string, dto: RoleplayReplyDto) {
    const s = this.scenario(dto.scenarioId);
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException('The last message must be the learner\'s.');
    const text = await this.or.complete(
      [{ role: 'system', content: replySystem(s, learner(dto)) }, ...dto.messages],
      { temperature: 0.8, maxTokens: 300 },
    );
    const reply = clean(text);
    if (!reply) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    await this.progress.practice(userId, `Roleplay: ${s.title} - ${last.content}`);
    return { reply };
  }

  /** Mistakes check + translation for one learner message (the right-hand panel). One AI request. */
  async feedback(dto: RoleplayFeedbackDto) {
    const l = learner(dto);
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: feedbackSystem(l) }, { role: 'user', content: dto.message }],
        { temperature: 0.3, maxTokens: 500 },
      );
      const j = parseJson(text);
      if (j && typeof j.correct === 'boolean') {
        return {
          // a message the AI calls wrong but could not fix is still shown as a warning, with its explanation
          correct: j.correct,
          corrected: j.correct ? '' : str(j.corrected, 1000),
          explanation: str(j.explanation, 400),
          translation: str(j.translation, 1000),
        };
      }
    }
    throw new BadGatewayException('The AI returned an unreadable review. Please try again.');
  }

  /** One message into the learner's native language (the translate button on the partner's bubbles). */
  async translate(dto: RoleplayTranslateDto) {
    const text = await this.or.complete(
      [{ role: 'system', content: translateSystem(learner(dto)) }, { role: 'user', content: dto.text }],
      { temperature: 0.2, maxTokens: 500 },
    );
    const translation = clean(text);
    if (!translation) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { translation };
  }

  /** The learner's current target language: saved chats are kept per language, like debates and Word Mode lessons. */
  private async language(userId: string): Promise<string> {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    return p?.language ?? 'Spanish';
  }

  private scenario(id: string) {
    const s = findRoleplay(id);
    if (!s) throw new NotFoundException('Unknown roleplay scenario.');
    return s;
  }
}
