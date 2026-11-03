import {
  BadGatewayException, HttpException, Injectable, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ORContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: ORContent };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Removes <think> blocks (closed, or still open because the output was cut off). */
function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<think(?:ing)?>[\s\S]*$/i, '')
    .trim();
}

/** Some models write their plan ("1. **Analyze the Request:** ...") into the answer itself. */
function looksLikeLeakedReasoning(text: string): boolean {
  const head = text.slice(0, 300);
  return (
    /^\s*(?:\d+\.\s*)?\*{0,2}\s*(analy[sz]e|deconstruct|understand|break ?down)\s+(the\s+)?(request|task|prompt|input)/i.test(head) ||
    /\*\*\s*(analy[sz]e|deconstruct)\s+the\s+(request|task|prompt)/i.test(head)
  );
}

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
              // Chat replies do not need hidden thinking: turn it off where the model allows it,
              // and never return it in the response.
              reasoning: { enabled: false, exclude: true },
            }),
            signal: AbortSignal.timeout(45_000),
          });

          if (res.ok) {
            const data: any = await res.json();
            const choice = data?.choices?.[0];
            const raw = choice?.message?.content;
            const text = typeof raw === 'string' ? stripThinking(raw) : '';
            if (text) {
              const truncated = choice?.finish_reason === 'length';
              if (looksLikeLeakedReasoning(text) || (truncated && text.length > 0 && looksLikeLeakedReasoning(text.slice(0, 300)))) {
                this.log.warn(`${model} returned its reasoning instead of an answer; trying the next model`);
                break; // next model
              }
              return text;
            }
            break; // empty answer: try the next model
          }
          if ([401, 402, 403].includes(res.status)) {
            throw new BadGatewayException(`OpenRouter rejected the request (${res.status}). Check your API key.`);
          }
          const detail = await this.errorDetail(res);
          this.log.warn(`${model} -> ${res.status} ${detail}`); // the real reason shows up in the backend terminal
          // The daily free quota is account-wide, so retrying or switching model cannot help.
          if (res.status === 429 && /per[- ]?day|daily/i.test(detail)) {
            throw new BadGatewayException(
              'OpenRouter says you used up the free requests for today (50 a day, unless you have ever bought $10 of credits, then 1,000). It resets each day (UTC), or add credits on openrouter.ai.',
            );
          }
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

  /** OpenRouter's error text, for the log and for telling a daily limit from a short busy spell. */
  private async errorDetail(res: Response): Promise<string> {
    try {
      const j: any = await res.json();
      const raw = j?.error?.metadata?.raw;
      return `${j?.error?.message ?? ''} ${raw ? (typeof raw === 'string' ? raw : JSON.stringify(raw)) : ''}`.trim().slice(0, 300);
    } catch {
      return '';
    }
  }
}