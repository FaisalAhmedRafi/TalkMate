import { BadGatewayException, Injectable } from '@nestjs/common';
import { ChatDto, FeedbackDto, GenerateDto, PhotoDto } from './dto';
import { OpenRouterService } from './openrouter.service';
import { chatSystem, feedbackSystem, generateSystem, Learner, photoSystem } from './prompts';

const learner = (d: { targetLanguage?: string; nativeLanguage?: string; level?: string }): Learner => ({
  targetLanguage: d.targetLanguage ?? 'Bengali',
  nativeLanguage: d.nativeLanguage ?? 'English',
  level: d.level ?? 'Beginner',
});

@Injectable()
export class AiService {
  constructor(private readonly or: OpenRouterService) {}

  async chat(dto: ChatDto) {
    const reply = await this.or.complete(
      [{ role: 'system', content: chatSystem(dto.mode, learner(dto), dto.context) }, ...dto.messages],
      { temperature: 0.8, maxTokens: dto.mode === 'call' ? 200 : 450 },
    );
    return { reply };
  }

  async generate(dto: GenerateDto) {
    const count = dto.count ?? (dto.type === 'flashcards' ? 8 : 6);
    const system = generateSystem(dto.type, dto.topic, count, learner(dto));
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.or.complete(
        [{ role: 'system', content: system }, { role: 'user', content: 'Generate it now.' }],
        { temperature: 0.6, maxTokens: 1400 },
      );
      const parsed = this.parseJson(text);
      if (parsed) return parsed;
    }
    throw new BadGatewayException('The AI returned an unreadable answer. Please try again.');
  }

  async photo(dto: PhotoDto) {
    const l = learner(dto);
    const feedback = await this.or.complete(
      [
        { role: 'system', content: photoSystem(l, !!dto.description?.trim()) },
        {
          role: 'user',
          content: [
            { type: 'text', text: dto.description?.trim() || 'Please describe this image for me.' },
            { type: 'image_url', image_url: { url: dto.image } },
          ],
        },
      ],
      { maxTokens: 700 },
    );
    return { feedback };
  }

  async feedback(dto: FeedbackDto) {
    const feedback = await this.or.complete(
      [
        { role: 'system', content: feedbackSystem(learner(dto)) },
        { role: 'user', content: dto.texts.map((t, i) => `${i + 1}. ${t}`).join('\n') },
      ],
      { temperature: 0.5, maxTokens: 500 },
    );
    return { feedback };
  }

  private parseJson(text: string): unknown | null {
    const cleaned = text.replace(/```json|```/g, '');
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    try {
      return JSON.parse(cleaned.slice(s, e + 1));
    } catch {
      return null;
    }
  }
}
