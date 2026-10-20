import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { CHARACTERS, findCharacter } from './characters.catalog';
import {
  CharacterFeedbackDto, CharacterReplyDto, CharacterSaveDto, CharacterSessionQueryDto, CharacterStartDto, CharacterTranslateDto,
} from './characters.dto';
import { feedbackSystem, openingSystem, replySystem, translateSystem } from './characters.prompts';

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
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
  ) {}

  /** The grid: every character and whether the learner has talked to them (in the language being learned). */
  async list(userId: string) {
    const language = await this.language(userId);
    const rows = await this.prisma.characterSession.findMany({ where: { userId, language }, select: { characterId: true, count: true } });
    const saved = new Map<string, number>(rows.filter((r) => findCharacter(r.characterId)).map((r): [string, number] => [r.characterId, r.count]));
    return {
      total: CHARACTERS.length,
      talked: [...saved.values()].filter((n) => n > 0).length,
      characters: CHARACTERS.map((c) => ({
        id: c.id, name: c.name, emoji: c.emoji, hue: c.hue, kind: c.kind, about: c.about,
        saved: saved.get(c.id) ?? 0, // learner messages in the saved conversation (0 = none)
      })),
    };
  }

  /** The saved conversation with a character, or { session: null }. */
  async session(userId: string, q: CharacterSessionQueryDto) {
    const c = this.character(q.characterId);
    const language = await this.language(userId);
    const row = await this.prisma.characterSession.findUnique({
      where: { userId_characterId_language: { userId, characterId: c.id, language } },
    });
    const messages = Array.isArray(row?.messages) ? (row!.messages as any[]) : [];
    if (!row || messages.length === 0) return { session: null };
    return {
      session: {
        intro: { characterId: c.id, name: c.name, emoji: c.emoji, hue: c.hue, about: c.about, opening: str(messages[0]?.content, 2000) },
        messages,
        reviews: row.reviews ?? {},
        translations: row.translations ?? {},
      },
    };
  }

  /** Saves the whole conversation (the client sends it after every change). Messages count as practice only through /characters/reply. */
  async save(userId: string, dto: CharacterSaveDto) {
    const c = this.character(dto.characterId);
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
    const where = { userId_characterId_language: { userId, characterId: c.id, language } };
    await this.prisma.characterSession.upsert({
      where,
      create: { userId, characterId: c.id, language, messages, reviews, translations, count },
      update: { messages, reviews, translations, count },
    });
    return { ok: true };
  }

  /** Throws the saved conversation away ("Start over", "Restart conversation"). */
  async clear(userId: string, q: CharacterSessionQueryDto) {
    const c = this.character(q.characterId);
    const language = await this.language(userId);
    await this.prisma.characterSession.deleteMany({ where: { userId, characterId: c.id, language } });
    return { ok: true };
  }

  /** Opens a conversation: the character greets the learner by name. One AI request. */
  async start(userId: string, dto: CharacterStartDto) {
    const c = this.character(dto.characterId);
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [
        { role: 'system', content: openingSystem(c, learner(dto), name) },
        { role: 'user', content: 'Write the first message now.' },
      ],
      { temperature: 0.8, maxTokens: 300 },
    );
    const opening = clean(text);
    if (!opening) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { characterId: c.id, name: c.name, emoji: c.emoji, hue: c.hue, about: c.about, opening };
  }

  /** The character's answer to the learner's latest message. Awards the same +10 XP as a Chat message. */
  async reply(userId: string, dto: CharacterReplyDto) {
    const c = this.character(dto.characterId);
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException("The last message must be the learner's.");
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [{ role: 'system', content: replySystem(c, learner(dto), name) }, ...dto.messages],
      { temperature: 0.85, maxTokens: 350 },
    );
    const reply = clean(text);
    if (!reply) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    await this.progress.practice(userId, `Characters: ${c.name} - ${last.content}`);
    return { reply };
  }

  /** Mistakes check + translation for one learner message (the right-hand panel). One AI request. */
  async feedback(dto: CharacterFeedbackDto) {
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

  /** One message into the learner's native language (the translate button on the character's bubbles). */
  async translate(dto: CharacterTranslateDto) {
    const text = await this.or.complete(
      [{ role: 'system', content: translateSystem(learner(dto)) }, { role: 'user', content: dto.text }],
      { temperature: 0.2, maxTokens: 500 },
    );
    const translation = clean(text);
    if (!translation) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { translation };
  }

  /** The learner's current target language: saved conversations are kept per language, like debates and Word Mode lessons. */
  private async language(userId: string): Promise<string> {
    const p = await this.prisma.progress.findUnique({ where: { userId }, select: { language: true } });
    return p?.language ?? 'Spanish';
  }

  private character(id: string) {
    const c = findCharacter(id);
    if (!c) throw new NotFoundException('Unknown character.');
    return c;
  }

  /** What the character calls the learner: the account name, else the first part of the email. */
  private async displayName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const raw = u?.name?.trim() || (u?.email ?? '').split('@')[0].replace(/[._\-+]+/g, ' ').replace(/\d+/g, '').trim();
    const first = raw.split(/\s+/)[0] ?? '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1, 40) : 'there';
  }
}
