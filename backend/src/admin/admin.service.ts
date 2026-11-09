import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CharacterPhotoService } from '../characters/characters.photos';
import { ContentStore, IMAGE_RE, StoredItem } from '../content/content.store';
import { AdminMode, CHARACTER_KINDS, CourseItem, DEFS, isMode, MODE_LABEL, MODES, nextPhotoId, Row, unitsOf } from '../content/content.defs';
import { ROLEPLAY_CATEGORIES } from '../roleplay/roleplay.catalog';
import { WordImageService } from '../word/word.images';

const MAX_IMPORT = 200;
const MAX_COVERS = 24; // pictures per request
const MAX_IMAGE_BYTES = 3_000_000;

/**
 * What the admin panel does with the content of the eight modes. The content itself lives in the database (see
 * ContentStore); this service validates what the panel sends, keeps pictures, and answers the table and the form.
 *
 * Built-in elements (`seeded`, loaded by a migration) and added ones are the same rows. Deleting an added element removes
 * its row; deleting a built-in one only hides it (`deleted`) so Restore can bring it back. Reset/Restore put back the
 * element's `original`, the copy of it saved when it was loaded. Learners' progress rows are never touched.
 */
@Injectable()
export class AdminService {
  constructor(private readonly store: ContentStore, private readonly images: WordImageService, private readonly characterPhotos: CharacterPhotoService) {}

  // ---------- reading ----------
  overview() {
    return {
      modes: MODES.map((m) => ({ mode: m, label: MODE_LABEL[m], ...this.countsOf(m) })),
      roleplayCategories: [...ROLEPLAY_CATEGORIES],
      characterKinds: CHARACTER_KINDS,
    };
  }

  rows(modeRaw: string): { mode: AdminMode; rows: Row[] } {
    const mode = this.mode(modeRaw);
    const ctx = { imageUrl: (f: string) => this.store.imageUrl(f) };
    const list = this.store.list(mode);
    const row = (i: StoredItem): Row => ({
      ...DEFS[mode].rowOf(i.data, ctx),
      id: i.itemId,
      custom: !i.seeded,
      ...(i.deleted ? { status: 'deleted' as const } : i.seeded && i.edited ? { status: 'edited' as const } : {}),
    });
    // deleted built-in elements go to the end of the table, where Restore is
    return { mode, rows: [...list.filter((i) => !i.deleted).map(row), ...list.filter((i) => i.deleted).map(row)] };
  }

  /**
   * The pictures for some rows of the table, which shows them instead of the emoji. Each mode finds its picture the way the
   * learner screens do (same search words, same cache keys), so a picture already shown to learners is not looked up again.
   * `null` = no picture (no stock-photo key set, nothing found): the table keeps the emoji.
   */
  async covers(modeRaw: string, ids: string[]): Promise<{ covers: Record<string, string | null> }> {
    const mode = this.mode(modeRaw);
    const list = [...new Set(ids)].slice(0, MAX_COVERS);
    const covers: Record<string, string | null> = {};
    if (mode === 'characters' && list.length) await this.characterPhotos.ensure().catch(() => undefined); // waits at most 8 s
    let next = 0;
    const worker = async () => { // a few at a time: stock-photo APIs have rate limits
      while (next < list.length) {
        const id = list[next++];
        covers[id] = await this.coverOf(mode, id).catch(() => null);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
    return { covers };
  }

  private async coverOf(mode: AdminMode, id: string): Promise<string | null> {
    const d = this.store.find(mode, id)?.data;
    if (!d) return null;
    if (d.file) return this.store.imageUrl(d.file); // a picture uploaded in the panel
    switch (mode) {
      case 'photo': return d.url ?? null; // a built-in photo: a path in the frontend's public folder
      case 'characters': return this.characterPhotos.cover(id); // the Wikipedia picture, once downloaded
      case 'word': return (await this.images.search(id, d.photo ?? ''))?.url ?? null;
      default: {
        const key = `${mode === 'flashcards' ? 'flash' : mode}-cover:${id}`;
        return (await this.images.search(key, d.photo ?? ''))?.url ?? null;
      }
    }
  }

  // ---------- writing ----------
  async create(modeRaw: string, raw: any, email: string) {
    const mode = this.mode(modeRaw);
    const data = await this.prepare(mode, raw);
    try {
      await this.store.insert(mode, data, email);
    } catch (e: any) {
      this.store.discardFile(data);
      if (e?.code === 'P2002') throw new ConflictException(`"${data.id}" already exists.`);
      throw e;
    }
    return { ok: true, id: data.id, ...this.countsOf(mode) };
  }

  /** Several elements at once. Each one is checked on its own; the bad ones are reported and skipped. */
  async import(modeRaw: string, items: unknown, email: string) {
    const mode = this.mode(modeRaw);
    if (mode === 'photo') throw new BadRequestException('Photos are uploaded from the form (pictures cannot be imported as JSON).');
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('Send a non-empty list of items.');
    if (items.length > MAX_IMPORT) throw new BadRequestException(`At most ${MAX_IMPORT} items per import.`);
    const results: { index: number; ok: boolean; id?: string; error?: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const r = await this.create(mode, items[i], email);
        results.push({ index: i, ok: true, id: r.id });
      } catch (e: any) {
        const m = e?.response?.message ?? e?.message ?? 'Failed';
        results.push({ index: i, ok: false, error: Array.isArray(m) ? m.join(', ') : String(m) });
      }
    }
    return { created: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, ...this.countsOf(mode) };
  }

  /** Delete an element: an added one for good, a built-in one by hiding it (Restore brings it back). */
  async remove(modeRaw: string, itemId: string) {
    const mode = this.mode(modeRaw);
    const item = this.existing(mode, itemId);
    if (item.deleted) throw new BadRequestException('It is already deleted. Use Restore to bring it back.');
    if (!item.seeded) {
      await this.store.hardDelete(mode, itemId);
      this.store.discardFile(item.data);
    } else {
      // hidden, with the original text: Restore then simply shows it again. Its edits (and an uploaded picture) go.
      const original = item.original;
      await this.store.save(mode, itemId, { deleted: true, edited: false, ...(original ? { data: original } : {}) });
      if (item.data?.file && item.data.file !== original?.file) this.store.discardFile(item.data);
    }
    return { ok: true, ...this.countsOf(mode) };
  }

  /** One element as the edit form shows it (lists become one line per entry, a script becomes Partner:/You: lines). */
  get(modeRaw: string, itemId: string) {
    const mode = this.mode(modeRaw);
    const item = this.existing(mode, itemId);
    if (item.deleted) throw new BadRequestException('It is deleted. Restore it first.');
    return { mode, id: itemId, item: this.formOf(item.data) };
  }

  /**
   * Change an element, built-in or added. Its id (the web address and the key of learners' progress) never changes, so
   * progress keeps counting. A picture is kept unless a new one is sent (or `removeImage` for a character portrait).
   */
  async update(modeRaw: string, itemId: string, raw: any) {
    const mode = this.mode(modeRaw);
    const item = this.existing(mode, itemId);
    if (item.deleted) throw new BadRequestException('It is deleted. Restore it first.');
    const old = item.data;
    const data = await this.prepare(mode, raw, old, item.seeded);
    try {
      await this.store.save(mode, itemId, { data, ...(item.seeded ? { edited: true } : {}) });
    } catch (e) {
      if (data.file && data.file !== old.file) this.store.discardFile(data);
      throw e;
    }
    if (old.file && old.file !== data.file) this.store.discardFile(old);
    return { ok: true, id: itemId, ...this.countsOf(mode) };
  }

  /** Put a built-in element back as the code defines it: Reset after an edit, Restore after a delete. */
  async restore(modeRaw: string, itemId: string) {
    const mode = this.mode(modeRaw);
    const item = this.existing(mode, itemId);
    if (!item.seeded || (!item.edited && !item.deleted)) throw new NotFoundException('Nothing to undo: this element is unchanged.');
    const original = item.original;
    if (!original && !item.deleted) throw new BadRequestException('No original was saved for this element, so there is nothing to reset to.');
    await this.store.save(mode, itemId, { deleted: false, edited: false, ...(original ? { data: original } : {}) });
    if (!item.deleted && item.data?.file && item.data.file !== original?.file) this.store.discardFile(item.data);
    return { ok: true, id: itemId, ...this.countsOf(mode) };
  }

  /**
   * What the Learn paths need: the elements that asked to be part of a course (`items`), and the built-in words, sentences
   * and dialogues an admin deleted (`removed`), which the fixed course paths in the frontend still list.
   */
  courseItems(): { items: CourseItem[]; removed: { mode: string; id: string }[] } {
    const items: CourseItem[] = [];
    const removed: { mode: string; id: string }[] = [];
    for (const mode of ['sentence', 'word', 'dialogue'] as const) {
      for (const i of this.store.list(mode)) {
        if (i.deleted) { if (i.seeded) removed.push({ mode, id: i.itemId }); continue; }
        if (!i.data?.course) continue;
        items.push({ mode, id: i.itemId, title: mode === 'word' ? i.data.english : i.data.title, course: i.data.course });
      }
    }
    return { items, removed };
  }

  // ---------- helpers ----------
  private existing(mode: AdminMode, itemId: string): StoredItem {
    const item = this.store.find(mode, itemId);
    if (!item) throw new NotFoundException('Unknown element.');
    return item;
  }

  private countsOf(mode: AdminMode) {
    const list = this.store.list(mode);
    return {
      total: list.filter((i) => !i.deleted).length,
      custom: list.filter((i) => !i.deleted && !i.seeded).length,
      /** built-in elements an admin edited or deleted */
      changed: list.filter((i) => i.seeded && (i.edited || i.deleted)).length,
      units: unitsOf(mode) ?? null,
    };
  }

  private formOf(d: any) {
    const f: any = { ...d };
    for (const k of ['sentences', 'examples', 'words']) if (Array.isArray(f[k])) f[k] = f[k].join('\n');
    if (Array.isArray(f.script)) f.script = f.script.map((t: any) => `Partner: ${t.partner}\nYou: ${t.you}`).join('\n');
    if (f.file) f.imageUrl = this.store.imageUrl(f.file);
    else if (f.url) f.imageUrl = f.url; // a built-in photo: a path in the frontend's public folder
    delete f.url; delete f.image; delete f.file; // the stored data URL is large and not needed by the form
    return f;
  }

  private mode(v: string): AdminMode {
    if (!isMode(v)) throw new BadRequestException(`Unknown mode "${v}".`);
    return v;
  }

  /**
   * Validate, reject duplicates and save a picture; returns the data to store. `existing` is the element's stored data
   * when it is being edited (then its id and, without a new picture, its picture stay). `seeded`: a built-in element.
   */
  private async prepare(mode: AdminMode, raw: any, existing?: any, seeded = false) {
    if (!raw || typeof raw !== 'object') throw new BadRequestException('Send the element as an object.');
    const data = DEFS[mode].normalize(raw);
    if (existing) {
      data.id = existing.id; // the id never changes: it keys learners' progress and the web address
    } else if (mode !== 'photo' && this.store.find(mode, data.id)) {
      // also true for a deleted built-in element: its id must not be reused, learners' progress rows still carry it
      const gone = this.store.find(mode, data.id)!.deleted;
      throw new ConflictException(gone
        ? `"${data.id}" was deleted from ${MODE_LABEL[mode]} mode. Restore it, or use a different title.`
        : `"${data.id}" already exists in ${MODE_LABEL[mode]} mode. Use a different title.`);
    }
    if (existing?.unitTitle && !data.unitTitle && data.unit === existing.unit) data.unitTitle = existing.unitTitle; // keep the title of the unit
    if (seeded && 'course' in data) data.course = ''; // built-in elements are already on their courses' paths; "Add to a course" is for added ones

    if (mode === 'photo' || mode === 'characters') {
      const sent = typeof raw.image === 'string' && raw.image !== '';
      if (!existing && mode === 'photo') data.id = nextPhotoId(this.store.list('photo').map((i) => i.itemId));
      if (sent) {
        const m = IMAGE_RE.exec(raw.image);
        if (!m) throw new BadRequestException('Add a PNG, JPEG or WebP picture.');
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length < 100 || buf.length > MAX_IMAGE_BYTES) throw new BadRequestException('The picture must be under 3 MB.');
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        const base = mode === 'photo' ? data.id : `char-${data.id}`;
        // a replaced picture gets a new file name, so browsers do not keep showing the old one
        data.file = `admin-photos/${base}${existing?.file || mode === 'characters' ? `-${Date.now().toString(36)}` : ''}.${ext}`;
        data.image = raw.image; // kept in the database so the file can be restored if the media folder is wiped
        this.store.writeFile(data.file, buf);
      } else if (existing?.file && !(mode === 'characters' && raw.removeImage === true)) {
        data.file = existing.file; data.image = existing.image;
      } else if (mode === 'photo' && existing?.url) {
        data.url = existing.url; // a built-in photo keeps its own picture
      } else if (mode === 'photo') {
        throw new BadRequestException('Add a PNG, JPEG or WebP picture.');
      }
    }
    return data;
  }
}
