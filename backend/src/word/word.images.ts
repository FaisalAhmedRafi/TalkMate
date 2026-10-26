import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { WordItem } from './word.catalog';

/**
 * Where downloaded stock photos live. On Railway this is the attached volume (RAILWAY_VOLUME_MOUNT_PATH), so the
 * pictures survive redeploys; MEDIA_DIR can override it; locally it is ./media. main.ts serves this folder at /media/.
 */
export const MEDIA_DIR = process.env.MEDIA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || join(process.cwd(), 'media');

export type WordImage = { url: string; credit: string; creditUrl: string; source?: string; sourceUrl?: string };

type Saved = { id: number; user: string; page: string };

/**
 * One stock photo per word, topic or scenario. Optional: with neither key set this returns null and the app
 * shows an emoji instead. Providers, in order:
 *  1. Pixabay (PIXABAY_API_KEY). Pixabay does not allow permanent hotlinking and its image URLs expire after
 *     24 hours, so the picture is downloaded once to backend/media/pixabay/<id>.jpg and served from this API
 *     at /media/pixabay/<id>.jpg. A query -> picture index (index.json) survives restarts, which also keeps
 *     API calls low (Pixabay asks for results to be cached for 24 hours).
 *  2. Pexels (PEXELS_API_KEY), hotlinked, cached in memory only.
 * Failures are never cached.
 */
@Injectable()
export class WordImageService {
  private readonly log = new Logger(WordImageService.name);
  private readonly cache = new Map<string, WordImage>();
  private readonly dir = join(MEDIA_DIR, 'pixabay');
  private readonly indexFile = join(this.dir, 'index.json');
  private index: Record<string, Saved> = {};
  private saving: Promise<void> = Promise.resolve();

  constructor(private readonly cfg: ConfigService) {
    try {
      mkdirSync(this.dir, { recursive: true });
      this.log.log(`Photo folder: ${this.dir}`);
      if (existsSync(this.indexFile)) this.index = JSON.parse(readFileSync(this.indexFile, 'utf8'));
    } catch (e) {
      this.log.warn(`Pixabay cache folder not usable: ${(e as Error).message}`);
    }
  }

  /** The photo for a Word Mode word. */
  find(item: WordItem): Promise<WordImage | null> {
    return this.search(item.id, item.photo);
  }

  /** A photo for any search text, cached under cacheKey (Flashcards, Roleplays, Debates and Dialogue use this too). */
  async search(cacheKey: string, query: string): Promise<WordImage | null> {
    if (!query.trim()) return null;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;
    const pixabay = (this.cfg.get<string>('PIXABAY_API_KEY') || '').trim();
    const pexels = (this.cfg.get<string>('PEXELS_API_KEY') || '').trim();
    const image = (pixabay && (await this.fromPixabay(pixabay, query))) || (pexels && (await this.fromPexels(pexels, query))) || null;
    if (image) this.cache.set(cacheKey, image);
    return image;
  }

  private publicUrl(id: number): string {
    let base = (this.cfg.get<string>('PUBLIC_API_URL') || `http://localhost:${this.cfg.get<string>('PORT') || 4000}`).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`; // a value saved without https:// would become a path on the frontend
    return `${base}/media/pixabay/${id}.jpg`;
  }

  private toImage(s: Saved): WordImage {
    return { url: this.publicUrl(s.id), credit: s.user || 'Pixabay', creditUrl: s.page || 'https://pixabay.com', source: 'Pixabay', sourceUrl: 'https://pixabay.com' };
  }

  private async fromPixabay(key: string, query: string): Promise<WordImage | null> {
    const q = query.trim().toLowerCase().slice(0, 100);
    // 'v2|' = picks made by the best-of-20 scoring below; bump it to make every photo be chosen again
    const idxKey = `v2|${q}`;
    const saved = this.index[idxKey];
    if (saved && existsSync(join(this.dir, `${saved.id}.jpg`))) return this.toImage(saved);
    try {
      const res = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&safesearch=true&min_width=640&per_page=20`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) {
        this.log.warn(`Pixabay "${q}" -> ${res.status}`);
        return null;
      }
      // pick the most relevant of the 20 results: tags that match the search words count most, popularity breaks ties
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const score = (h: any) =>
        words.filter((w) => String(h.tags ?? '').toLowerCase().includes(w)).length * 10 +
        Math.log10((h.likes ?? 0) + 1) +
        Math.log10((h.downloads ?? 0) + 1) * 0.5;
      const hits: any[] = (await res.json())?.hits ?? [];
      const p = hits.filter((h) => h?.id && h?.webformatURL).sort((a, b) => score(b) - score(a))[0];
      if (!p?.id || !p?.webformatURL) return null;
      // download now: the webformatURL stops working after 24 hours and hotlinking is not allowed
      const img = await fetch(String(p.webformatURL), { signal: AbortSignal.timeout(10000) });
      if (!img.ok) {
        this.log.warn(`Pixabay download "${q}" -> ${img.status}`);
        return null;
      }
      await writeFile(join(this.dir, `${Number(p.id)}.jpg`), Buffer.from(await img.arrayBuffer()));
      const entry: Saved = { id: Number(p.id), user: String(p.user ?? ''), page: String(p.pageURL ?? '') };
      this.index[idxKey] = entry;
      // one write at a time so parallel lookups cannot interleave into a broken file
      this.saving = this.saving.then(() => writeFile(this.indexFile, JSON.stringify(this.index))).catch(() => undefined);
      return this.toImage(entry);
    } catch (e) {
      this.log.warn(`Pixabay "${q}" failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async fromPexels(key: string, query: string): Promise<WordImage | null> {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
        { headers: { Authorization: key }, signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) {
        this.log.warn(`Pexels "${query}" -> ${res.status}`);
        return null;
      }
      const p = (await res.json())?.photos?.[0];
      if (!p?.src?.large) return null;
      return {
        url: String(p.src.large),
        credit: String(p.photographer ?? 'Pexels'),
        creditUrl: String(p.url ?? 'https://www.pexels.com'),
        source: 'Pexels',
        sourceUrl: 'https://www.pexels.com',
      };
    } catch (e) {
      this.log.warn(`Pexels "${query}" failed: ${(e as Error).message}`);
      return null;
    }
  }
}