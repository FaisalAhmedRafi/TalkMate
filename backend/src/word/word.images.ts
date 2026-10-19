import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WordItem } from './word.catalog';

export type WordImage = { url: string; credit: string; creditUrl: string };

/**
 * One stock photo per word from Pexels (https://www.pexels.com/api/). Optional: without PEXELS_API_KEY
 * this returns null and the app shows the word's emoji instead. Results are cached in memory, so each
 * word costs at most one Pexels request per server run. Failures are never cached.
 */
@Injectable()
export class WordImageService {
  private readonly log = new Logger(WordImageService.name);
  private readonly cache = new Map<string, WordImage>();

  constructor(private readonly cfg: ConfigService) {}

  async find(item: WordItem): Promise<WordImage | null> {
    const key = (this.cfg.get<string>('PEXELS_API_KEY') || '').trim();
    if (!key) return null;
    const hit = this.cache.get(item.id);
    if (hit) return hit;
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(item.photo)}&per_page=1&orientation=landscape`,
        { headers: { Authorization: key }, signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) {
        this.log.warn(`Pexels "${item.photo}" -> ${res.status}`);
        return null;
      }
      const p = (await res.json())?.photos?.[0];
      if (!p?.src?.large) return null;
      const image: WordImage = {
        url: String(p.src.large),
        credit: String(p.photographer ?? 'Pexels'),
        creditUrl: String(p.url ?? 'https://www.pexels.com'),
      };
      this.cache.set(item.id, image);
      return image;
    } catch (e) {
      this.log.warn(`Pexels "${item.photo}" failed: ${(e as Error).message}`);
      return null;
    }
  }
}
