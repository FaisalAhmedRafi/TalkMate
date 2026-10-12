import {
  BadGatewayException, HttpException, Injectable, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ORContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: ORContent };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class OpenRouterService {
  private readonly log = new Logger(OpenRouterService.name);
  constructor(private readonly cfg: ConfigService) {}

  async complete(messages: ORMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
    const key = this.cfg.get<string>('OPENROUTER_API_KEY');
    if (!key) throw new ServiceUnavailableException('OPENROUTER_API_KEY is not set on the server');

    const primary = this.cfg.get<string>('OPENROUTER_MODEL') || 'openrouter/free';
    const fallbacks = (this.cfg.get<string>('OPENROUTER_FALLBACK_MODELS') || '')
      .split(',').map((m) => m.trim()).filter(Boolean);

    for (const model of [primary, ...fallbacks]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              'X-Title': 'TalkMate',
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: opts.temperature ?? 0.7,
              max_tokens: opts.maxTokens ?? 700,
            }),
            signal: AbortSignal.timeout(45_000),
          });

          if (res.ok) {
            const data: any = await res.json();
            const text = data?.choices?.[0]?.message?.content;
            if (typeof text === 'string' && text.trim()) return text.trim();
            break; // empty answer: try the next model
          }
          if ([401, 402, 403].includes(res.status)) {
            throw new BadGatewayException(`OpenRouter rejected the request (${res.status}). Check your API key.`);
          }
          this.log.warn(`${model} -> ${res.status}`);
          if (res.status === 429 || res.status >= 500) {
            await sleep(700 * (attempt + 1));
            continue; // retry once, then fall through to the next model
          }
          break;
        } catch (e) {
          if (e instanceof HttpException) throw e;
          this.log.warn(`${model} failed: ${(e as Error).message}`);
        }
      }
    }
    throw new BadGatewayException('The free AI models are busy or rate limited. Try again in a minute.');
  }
}
