import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { CHARACTERS } from './characters.catalog';
import { MEDIA_DIR } from '../word/word.images';

/** Wikipedia article whose lead picture is used for a character. A character without a line keeps the emoji tile. */
export const CHARACTER_WIKI: Record<string, string> = {
  loki: 'Loki', odin: 'Odin', thor: 'Thor', shiva: 'Shiva', zeus: 'Zeus', osiris: 'Osiris', aphrodite: 'Aphrodite',
  'abraham-lincoln': 'Abraham Lincoln', 'marco-polo': 'Marco Polo', 'alan-turing': 'Alan Turing', 'alexander-the-great': 'Alexander the Great',
  'amelia-earhart': 'Amelia Earhart', confucius: 'Confucius', dracula: 'Count Dracula', archimedes: 'Archimedes', 'attila-the-hun': 'Attila', 'frankensteins-monster': "Frankenstein's monster",
  beethoven: 'Ludwig van Beethoven', 'soren-kierkegaard': 'Søren Kierkegaard', 'benjamin-franklin': 'Benjamin Franklin', buddha: 'Gautama Buddha',
  'catherine-the-great': 'Catherine the Great', charlemagne: 'Charlemagne', 'charles-darwin': 'Charles Darwin', cleopatra: 'Cleopatra',
  'sherlock-holmes': 'Sherlock Holmes', 'albert-einstein': 'Albert Einstein', 'leonardo-da-vinci': 'Leonardo da Vinci', 'marie-curie': 'Marie Curie',
  'william-shakespeare': 'William Shakespeare',
};

/**
 * Exact picture for a character, chosen by you; it wins over the article's lead image. Use the file name from the
 * picture's Wikipedia/Commons page: click the picture, then copy the part after /wiki/ in the address bar, e.g.
 * 'File:Attila the Hun.jpg'. A name that is wrong is skipped (the lead image, then the best picture in the article, is used instead).
 */
export const CHARACTER_FILE: Record<string, string> = {
  // 1831 frontispiece of Frankenstein (public domain). Remove this line to use whatever Wikipedia shows as lead image.
  'frankensteins-monster': 'File:Frontispiece to Frankenstein 1831.jpg',
  // 'attila-the-hun': 'File:<file name of the reconstruction portrait>.jpg',
};

/** The picture URL (600 px wide where possible) from an imageinfo response. Pure, so it can be tested. */
export function imageUrlFromInfo(json: any): string | null {
  const page = Object.values(json?.query?.pages ?? {})[0] as { imageinfo?: { thumburl?: string; url?: string }[] } | undefined;
  const info = page?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}

/**
 * When an article has no lead image: the picture in the article that fits best, judged by its file name (the character's
 * name and words such as portrait, reconstruction, statue or painting). Icons, logos, flags, maps and SVGs are skipped.
 * Returns null when nothing fits, so a wrong picture is never guessed. Pure, so it can be tested.
 */
export function bestArticleImage(json: any, articleTitle: string): string | null {
  const pages = Object.values(json?.query?.pages ?? {}) as { images?: { title: string }[] }[];
  const titles = pages.flatMap((p) => p.images ?? []).map((i) => i.title);
  const skip = /(icon|logo|flag|map|symbol|signature|seal|coat of arms|commons|wikimedia|wikipedia|question|edit|stub|ambox|portal|disambig|folder|blank|\.svg$|\.ogg$|\.wav$)/i;
  const words = articleTitle.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const score = (t: string) => {
    const n = t.toLowerCase();
    return words.filter((w) => n.includes(w)).length * 3 + (/(portrait|reconstruct|bust|statue|painting|depict|illustration|frontispiece)/.test(n) ? 2 : 0);
  };
  const ok = titles.filter((t) => /\.(jpe?g|png)$/i.test(t) && !skip.test(t));
  const best = ok.sort((a, b) => score(b) - score(a))[0];
  return best && score(best) > 0 ? best : null;
}

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
  private readonly dir = join(MEDIA_DIR, 'characters');
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
    let base = (this.cfg.get<string>('PUBLIC_API_URL') || `http://localhost:${this.cfg.get<string>('PORT') || 4000}`).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    return `${base}/media/characters/${id}.jpg`;
  }

  /** The picture URL for a character, or null when it has not been downloaded (yet). */
  cover(id: string): string | null {
    return existsSync(this.file(id)) ? this.publicUrl(id) : null;
  }

  /** Downloads any missing pictures. Waits at most 8 seconds, so the first Characters load is never held up for long; the rest finish in the background. */
  async ensure(): Promise<void> {
    const missing = CHARACTERS.filter((c) => (CHARACTER_WIKI[c.id] || CHARACTER_FILE[c.id]) && !existsSync(this.file(c.id)));
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

  private readonly headers = { 'User-Agent': 'TalkMate/1.0 (language learning app; character pictures)' };

  /** URL of a Wikipedia/Commons file (e.g. 'File:Attila.jpg'), 600 px wide. */
  private async fileUrl(title: string): Promise<string | null> {
    const t = /^file:/i.test(title) ? title : `File:${title}`;
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&titles=${encodeURIComponent(t)}`,
      { headers: this.headers, signal: AbortSignal.timeout(10000) },
    );
    return res.ok ? imageUrlFromInfo(await res.json()) : null;
  }

  /** Where this character's picture comes from: your chosen file, else the article's lead image, else the best picture in the article. */
  private async pickSource(id: string, thumbs: Record<string, string>): Promise<string | null> {
    const wiki = CHARACTER_WIKI[id];
    try {
      const file = CHARACTER_FILE[id];
      if (file) {
        const u = await this.fileUrl(file);
        if (u) return u;
        this.log.warn(`File "${file}" not found for ${id}`);
      }
      if (wiki && thumbs[wiki]) return thumbs[wiki];
      if (wiki) {
        const res = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&prop=images&imlimit=100&redirects=1&format=json&titles=${encodeURIComponent(wiki)}`,
          { headers: this.headers, signal: AbortSignal.timeout(10000) },
        );
        const best = res.ok ? bestArticleImage(await res.json(), wiki) : null;
        if (best) return await this.fileUrl(best);
      }
    } catch (e) {
      this.log.warn(`Picture source for ${id} failed: ${(e as Error).message}`);
    }
    return null;
  }

  private async download(ids: string[]): Promise<void> {
    const headers = this.headers;
    const titles = ids.map((id) => CHARACTER_WIKI[id]).filter(Boolean);
    let thumbs: Record<string, string> = {};
    if (titles.length) {
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=600&redirects=1&format=json&titles=${encodeURIComponent(titles.join('|'))}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) throw new Error(`Wikipedia API -> ${res.status}`);
      thumbs = thumbsByTitle((await res.json()) as WikiJson, titles);
    }
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const id = ids[next++];
        const src = await this.pickSource(id, thumbs);
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