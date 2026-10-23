import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { Learner } from '../ai/prompts';
import { OpenRouterService } from '../ai/openrouter.service';
import { PrismaService } from '../prisma/prisma.module';
import { ProgressService } from '../progress/progress.service';
import { CallAdvancedDto, CallFeedbackDto, CallReplyDto, CallTranslateDto } from './call.dto';
import { advancedSystem, feedbackSystem, openingSystem, replySystem, TEACHER, translateSystem } from './call.prompts';

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

/** Call Mode: a voice call with the teacher Kai. Nothing is saved; a call lives in the browser until it is closed. */
@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly or: OpenRouterService,
    private readonly progress: ProgressService,
  ) {}

  /** Kai's first line when the call connects. */
  async start(userId: string, dto: { targetLanguage?: string; nativeLanguage?: string; level?: string }) {
    const l = learner(dto);
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [{ role: 'system', content: openingSystem(l, name) }, { role: 'user', content: 'Say your first line now.' }],
      { temperature: 0.7, maxTokens: 200 },
    );
    const opening = clean(text);
    if (!opening) throw new BadGatewayException('The AI returned an empty answer. Please try again.');
    return { teacher: TEACHER, opening };
  }

  /** Kai's answer to the learner's latest message. Awards the same +10 XP as a Chat message. */
  async reply(userId: string, dto: CallReplyDto) {
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') throw new BadRequestException('The last message must be the learner\'s.');
    const name = await this.displayName(userId);
    const text = await this.or.complete(
      [{ role: 'system', content: replySystem(learner(dto), name) }, ...dto.messages],
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

  /** One of Kai's lines into the learner's native language (the translate button). */
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
    const transcript = dto.messages.map((m) => `${m.role === 'user' ? 'Learner' : TEACHER.name}: ${m.content}`).join('\n');
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: advancedSystem(learner(dto)) }, { role: 'user', content: transcript }],
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

  /** What Kai calls the learner: the account name, else the first part of the email. */
  private async displayName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const raw = u?.name?.trim() || (u?.email ?? '').split('@')[0].replace(/[._\-+]+/g, ' ').replace(/\d+/g, '').trim();
    const first = raw.split(/\s+/)[0] ?? '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1, 40) : 'there';
  }
}
