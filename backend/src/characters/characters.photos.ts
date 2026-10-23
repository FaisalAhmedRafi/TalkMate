import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { CHARACTERS } from './characters.catalog';

/** Wikipedia article whose lead picture is used for a character. A character without a line keeps the emoji tile. */
export const CHARACTER_WIKI: Record<string, string> = {
  loki: 'Loki', odin: 'Odin', thor: 'Thor', shiva: 'Shiva', zeus: 'Zeus', osiris: 'Osiris', aphrodite: 'Aphrodite',
  'abraham-lincoln': 'Abraham Lincoln', 'marco-polo': 'Marco Polo', 'alan-turing': 'Alan Turing', 'alexander-the-great': 'Alexander the Great',
  'amelia-earhart': 'Amelia Earhart', confucius: 'Confucius', dracula: 'Count Dracula', archimedes: 'Archimedes', 'attila-the-hun': 'Attila',
  beethoven: 'Ludwig van Beethoven', 'soren-kierkegaard': 'Søren Kierkegaard', 'benjamin-franklin': 'Benjamin Franklin', buddha: 'Gautama Buddha',
  'catherine-the-great': 'Catherine the Great', charlemagne: 'Charlemagne', 'charles-darwin': 'Charles Darwin', cleopatra: 'Cleopatra',
  'sherlock-holmes': 'Sherlock Holmes', 'albert-einstein': 'Albert Einstein', 'leonardo-da-vinci': 'Leonardo da Vinci', 'marie-curie': 'Marie Curie',
  'william-shakespeare': 'William Shakespeare',
};

type WikiJson = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; thumbnail?: { source: string } }>;
  };
};

/** Maps each requested title to its lead picture URL, following Wikipedia's title normalisation and redirects. Pure, so it can be tested. */
export function thumbsByTitle(json: WikiJson, titles: string[]): Record<string, string> {
  const q = json.query ?? {};
  const pages = Object.values(q.pages ?? {});
  const out: Record<string, string> = {};
  for (const t of titles) {
    const n = q.normalized?.find((x) => x.from === t)?.to ?? t;
    const r = q.redirects?.find((x) => x.from === n)?.to ?? n;
    const src = pages.find((p) => p.title === r)?.thumbnail?.source;
    if (src) out[t] = src;
  }
  return out;
}

/**
 * Real pictures for Characters Mode: the lead image of each character's Wikipedia article (portraits, paintings, statues).
 * No API key. The pictures are downloaded once to backend/media/characters/<id>.jpg and served by this API at
 * /media/characters/<id>.jpg, so there is no hotlinking and nothing is fetched again after the first run.
 * Most lead images are public domain; some are not, which is why the UI credits Wikipedia.
 */
@Injectable()
export class CharacterPhotoService {
  private readonly log = new Logger(CharacterPhotoService.name);
  private readonly dir = join(process.cwd(), 'media', 'characters');
  private job: Promise<void> | null = null;
  private retryAfter = 0;

  constructor(private readonly cfg: ConfigService) {
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch (e) {
      this.log.warn(`Character picture folder not usable: ${(e as Error).message}`);
    }
  }

  private file(id: string) {
    return join(this.dir, `${id}.jpg`);
  }

  private publicUrl(id: string): string {
    const base = (this.cfg.get<string>('PUBLIC_API_URL') || `http://localhost:${this.cfg.get<string>('PORT') || 4000}`).replace(/\/+$/, '');
    return `${base}/media/characters/${id}.jpg`;
  }

  /** The picture URL for a character, or null when it has not been downloaded (yet). */
  cover(id: string): string | null {
    return existsSync(this.file(id)) ? this.publicUrl(id) : null;
  }

  /** Downloads any missing pictures. Waits at most 8 seconds, so the first Characters load is never held up for long; the rest finish in the background. */
  async ensure(): Promise<void> {
    const missing = CHARACTERS.filter((c) => CHARACTER_WIKI[c.id] && !existsSync(this.file(c.id)));
    if (!missing.length || Date.now() < this.retryAfter) return;
    if (!this.job) {
      this.job = this.download(missing.map((c) => c.id))
        .catch((e) => {
          this.retryAfter = Date.now() + 10 * 60 * 1000; // do not hammer Wikipedia after a failure
          this.log.warn(`Character pictures failed: ${(e as Error).message}`);
        })
        .finally(() => { this.job = null; });
    }
    await Promise.race([this.job, new Promise((r) => setTimeout(r, 8000))]);
  }

  private async download(ids: string[]): Promise<void> {
    // Wikimedia asks every client to send a descriptive User-Agent
    const headers = { 'User-Agent': 'TalkMate/1.0 (language learning app; character pictures)' };
    const titles = ids.map((id) => CHARACTER_WIKI[id]);
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=600&redirects=1&format=json&titles=${encodeURIComponent(titles.join('|'))}`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error(`Wikipedia API -> ${res.status}`);
    const thumbs = thumbsByTitle((await res.json()) as WikiJson, titles);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const id = ids[next++];
        const src = thumbs[CHARACTER_WIKI[id]];
        if (!src) { this.log.warn(`No Wikipedia picture for ${id}`); continue; }
        try {
          const img = await fetch(src, { headers, signal: AbortSignal.timeout(15000) });
          if (!img.ok) { this.log.warn(`Picture ${id} -> ${img.status}`); continue; }
          await writeFile(this.file(id), Buffer.from(await img.arrayBuffer()));
        } catch (e) {
          this.log.warn(`Picture ${id} failed: ${(e as Error).message}`);
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]); // four at a time
  }
}
