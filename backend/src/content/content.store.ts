import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { PrismaService } from '../prisma/prisma.module';
import { MEDIA_DIR } from '../word/word.images';
import { AdminMode, DEFS, MODES, Stored } from './content.defs';

export const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

/** One row of ContentItem, as the rest of the app sees it. */
export type StoredItem = Stored & {
  position: number | null;
  /** a built-in element (loaded by a migration), as opposed to one added in the Admin panel */
  seeded: boolean;
  /** a built-in element an admin changed */
  edited: boolean;
  deleted: boolean;
  /** a built-in element exactly as first defined: what Reset and Restore put back (null for added elements) */
  original: any | null;
  createdAt: Date;
};

const UNIT_MODES: AdminMode[] = ['sentence', 'word', 'photo'];
const POLL_MS = 15_000;

/** The order everything is listed and loaded in: unit number first for the modes with units, then position, then age. */
const byOrder = (mode: AdminMode) => (a: StoredItem, b: StoredItem) => {
  if (UNIT_MODES.includes(mode)) {
    const u = (Number(a.data?.unit) || 0) - (Number(b.data?.unit) || 0);
    if (u) return u;
  }
  const p = (a.position ?? 1e9) - (b.position ?? 1e9);
  return p || a.createdAt.getTime() - b.createdAt.getTime() || a.itemId.localeCompare(b.itemId);
};

/**
 * The single place the content of the eight modes lives: the database table ContentItem. There is no content in the code.
 *
 * - At startup it reads every row and fills the LIVE catalog arrays the mode services read on every request. The built-in
 *   content is in the table too (a migration loaded it), next to the elements added in the Admin panel.
 * - Every admin write reloads that mode here, and a light poll (one aggregate query every 15 s) makes other API instances
 *   pick the change up too, so several servers always show the same content.
 * - If the table cannot be read the API does not start (like a missing database): serving empty content would be worse,
 *   and the platform restarts the process, so a short database outage at boot heals itself.
 */
@Injectable()
export class ContentStore implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ContentStore.name);
  private readonly items = new Map<AdminMode, StoredItem[]>(MODES.map((m) => [m, []]));
  private fingerprint = '';
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService, private readonly cfg: ConfigService) {}

  async onModuleInit() {
    try {
      await this.reloadAll();
      this.fingerprint = await this.fingerprintNow();
    } catch (e) {
      this.log.error(`Cannot load the content from the database (${(e as Error).message}). Run \`npm run prisma:deploy\` (table ContentItem and the built-in content are created by migrations).`);
      throw e;
    }
    const counts = MODES.map((m) => `${m} ${this.items.get(m)!.filter((i) => !i.deleted).length}`).join(', ');
    if (MODES.every((m) => this.items.get(m)!.length === 0)) this.log.warn('The ContentItem table is empty: run `npm run prisma:deploy` to load the built-in content.');
    this.log.log(`Content loaded: ${counts}.`);
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ---------- reading ----------
  /** Every row of a mode (deleted ones too) in display order. */
  list(mode: AdminMode): StoredItem[] { return this.items.get(mode) ?? []; }
  find(mode: AdminMode, itemId: string): StoredItem | undefined { return this.list(mode).find((i) => i.itemId === itemId); }
  // ---------- writing (each one reloads the mode) ----------
  async insert(mode: AdminMode, data: any, email: string) {
    await this.prisma.contentItem.create({ data: { mode, itemId: data.id, position: this.nextPosition(mode), data, seeded: false, createdBy: email || null } });
    await this.afterWrite(mode);
  }
  async save(mode: AdminMode, itemId: string, patch: { data?: any; edited?: boolean; deleted?: boolean }) {
    await this.prisma.contentItem.update({ where: { mode_itemId: { mode, itemId } }, data: patch });
    await this.afterWrite(mode);
  }
  async hardDelete(mode: AdminMode, itemId: string) {
    await this.prisma.contentItem.deleteMany({ where: { mode, itemId } });
    await this.afterWrite(mode);
  }

  // ---------- pictures (photo elements and character portraits live in the media folder) ----------
  imageUrl(file: string) { return `${this.publicBase()}/media/${file}`; }
  writeFile(file: string, buf: Buffer) {
    const path = join(MEDIA_DIR, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buf);
  }
  discardFile(data: any) {
    if (!data?.file) return;
    try { unlinkSync(join(MEDIA_DIR, data.file)); } catch { /* already gone */ }
  }
  /** Re-create a picture that is missing from disk (a redeploy without a volume) from the copy kept in the database. */
  private ensureFile(data: any) {
    if (!data?.file || existsSync(join(MEDIA_DIR, data.file))) return;
    const m = IMAGE_RE.exec(data.image ?? '');
    if (m) this.writeFile(data.file, Buffer.from(m[2], 'base64'));
  }
  private publicBase(): string {
    let base = (this.cfg.get<string>('PUBLIC_API_URL') || `http://localhost:${this.cfg.get<string>('PORT') || 4000}`).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    return base;
  }

  // ---------- internals ----------
  private toStored(r: any): StoredItem {
    return { itemId: r.itemId, data: r.data, position: r.position ?? null, seeded: !!r.seeded, edited: !!r.edited, deleted: !!r.deleted, original: r.original ?? null, createdAt: r.createdAt };
  }

  private async reloadAll() {
    const rows = await this.prisma.contentItem.findMany();
    for (const m of MODES) this.apply(m, rows.filter((r: any) => r.mode === m).map((r: any) => this.toStored(r)));
  }
  private async reload(mode: AdminMode) {
    const rows = await this.prisma.contentItem.findMany({ where: { mode } });
    this.apply(mode, rows.map((r: any) => this.toStored(r)));
  }

  /** Remember the rows and rebuild the mode's live catalog from the ones that are not deleted. */
  private apply(mode: AdminMode, list: StoredItem[]) {
    list.sort(byOrder(mode));
    this.items.set(mode, list);
    const live = list.filter((i) => !i.deleted);
    for (const i of live) this.ensureFile(i.data);
    DEFS[mode].load(live, { imageUrl: (f) => this.imageUrl(f) });
  }

  private nextPosition(mode: AdminMode) {
    return this.list(mode).reduce((n, i) => Math.max(n, i.position ?? -1), -1) + 1;
  }

  private async afterWrite(mode: AdminMode) {
    await this.reload(mode);
    this.fingerprint = await this.fingerprintNow().catch(() => this.fingerprint); // our own write is not news to this instance
  }

  private async fingerprintNow() {
    const a = await this.prisma.contentItem.aggregate({ _count: { _all: true }, _max: { updatedAt: true } });
    return `${a._count._all}:${a._max.updatedAt ? new Date(a._max.updatedAt).getTime() : 0}`;
  }
  /** Another API instance changed something: reload everything. A failed check is simply tried again next time. */
  private async poll() {
    try {
      const f = await this.fingerprintNow();
      if (f === this.fingerprint) return;
      await this.reloadAll();
      this.fingerprint = f;
    } catch (e) { this.log.warn(`Content refresh failed: ${(e as Error).message}`); }
  }
}
