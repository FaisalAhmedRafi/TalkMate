import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { PrismaService } from '../prisma/prisma.module';
import { MEDIA_DIR } from '../word/word.images';
import { ROLEPLAY_CATEGORIES } from '../roleplay/roleplay.catalog';
import { AdminMode, CHARACTER_KINDS, DEFS, isMode, MODE_LABEL, MODES, nextPhotoId, Row, unitsOf } from './admin.content';

const MAX_IMPORT = 200;
const MAX_IMAGE_BYTES = 3_000_000;
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly log = new Logger(AdminService.name);
  /** ids added from the panel, per mode (the rest of each catalog is built in) */
  private readonly custom = new Map<AdminMode, Set<string>>(MODES.map((m) => [m, new Set<string>()]));

  constructor(private readonly prisma: PrismaService, private readonly cfg: ConfigService) {}

  /** Load every saved element into the live catalogs when the API starts. */
  async onModuleInit() {
    try {
      const rows = await this.prisma.customContent.findMany({ orderBy: { createdAt: 'asc' } });
      for (const r of rows) {
        if (!isMode(r.mode)) continue;
        try { this.attach(r.mode, r.data as any); } catch (e) { this.log.warn(`Skipped ${r.mode}/${r.itemId}: ${(e as Error).message}`); }
      }
      this.log.log(`Loaded ${rows.length} custom element(s).`);
    } catch (e) {
      // e.g. the migration has not been applied yet: the app must still boot with its built-in content
      this.log.warn(`Custom content not loaded (${(e as Error).message}). Run \`npm run prisma:deploy\`.`);
    }
  }

  // ---------- reading ----------
  overview() {
    return {
      modes: MODES.map((m) => {
        const ids = DEFS[m].ids();
        const custom = this.custom.get(m)!.size;
        return { mode: m, label: MODE_LABEL[m], total: ids.length, custom, units: unitsOf(m) ?? null };
      }),
      roleplayCategories: [...ROLEPLAY_CATEGORIES],
      characterKinds: CHARACTER_KINDS,
    };
  }

  rows(modeRaw: string): { mode: AdminMode; rows: Row[] } {
    const mode = this.mode(modeRaw);
    const set = this.custom.get(mode)!;
    return { mode, rows: DEFS[mode].rows((id) => set.has(id), { imageUrl: (f) => this.imageUrl(f) }) };
  }

  // ---------- writing ----------
  async create(modeRaw: string, raw: any, email: string) {
    const mode = this.mode(modeRaw);
    const data = await this.prepare(mode, raw);
    try {
      await this.prisma.customContent.create({ data: { mode, itemId: data.id, data, createdBy: email } });
    } catch (e: any) {
      this.discardFile(data);
      if (e?.code === 'P2002') throw new ConflictException(`"${data.id}" already exists.`);
      throw e;
    }
    this.attach(mode, data);
    return { ok: true, id: data.id, ...this.overviewOf(mode) };
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
    return { created: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, ...this.overviewOf(mode) };
  }

  /** Delete an element that was added from the panel. Built-in elements cannot be deleted. */
  async remove(modeRaw: string, itemId: string) {
    const mode = this.mode(modeRaw);
    if (!this.custom.get(mode)!.has(itemId)) {
      if (DEFS[mode].ids().includes(itemId)) throw new BadRequestException('Built-in elements cannot be deleted here.');
      throw new NotFoundException('Unknown element.');
    }
    const row = await this.prisma.customContent.findUnique({ where: { mode_itemId: { mode, itemId } } });
    await this.prisma.customContent.deleteMany({ where: { mode, itemId } });
    if (row) this.discardFile(row.data as any);
    // rebuild this mode from the database so units that only this element created disappear too
    DEFS[mode].clear();
    this.custom.get(mode)!.clear();
    const rows = await this.prisma.customContent.findMany({ where: { mode }, orderBy: { createdAt: 'asc' } });
    for (const r of rows) { try { this.attach(mode, r.data as any); } catch (e) { this.log.warn(`Skipped ${mode}/${r.itemId}: ${(e as Error).message}`); } }
    return { ok: true, ...this.overviewOf(mode) };
  }

  // ---------- helpers ----------
  private overviewOf(mode: AdminMode) {
    return { total: DEFS[mode].ids().length, custom: this.custom.get(mode)!.size, units: unitsOf(mode) ?? null };
  }

  private mode(v: string): AdminMode {
    if (!isMode(v)) throw new BadRequestException(`Unknown mode "${v}".`);
    return v;
  }

  private attach(mode: AdminMode, data: any) {
    if (mode === 'photo') this.ensureFile(data);
    DEFS[mode].add(data, { imageUrl: (f) => this.imageUrl(f) });
    this.custom.get(mode)!.add(data.id);
  }

  /** Validate, reject duplicates and (for photos) save the picture; returns the data to store. */
  private async prepare(mode: AdminMode, raw: any) {
    if (!raw || typeof raw !== 'object') throw new BadRequestException('Send the element as an object.');
    const data = DEFS[mode].normalize(raw);
    if (mode === 'photo') {
      const m = IMAGE_RE.exec(typeof raw.image === 'string' ? raw.image : '');
      if (!m) throw new BadRequestException('Add a PNG, JPEG or WebP picture.');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length < 100 || buf.length > MAX_IMAGE_BYTES) throw new BadRequestException('The picture must be under 3 MB.');
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      data.id = nextPhotoId();
      data.file = `admin-photos/${data.id}.${ext}`;
      data.image = raw.image; // kept in the database so the file can be restored if the media folder is wiped
      this.writeFile(data.file, buf);
    } else if (DEFS[mode].ids().includes(data.id)) {
      throw new ConflictException(`"${data.id}" already exists in ${MODE_LABEL[mode]} mode. Use a different title.`);
    }
    return data;
  }

  private publicBase(): string {
    let base = (this.cfg.get<string>('PUBLIC_API_URL') || `http://localhost:${this.cfg.get<string>('PORT') || 4000}`).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    return base;
  }
  private imageUrl(file: string) { return `${this.publicBase()}/media/${file}`; }

  private writeFile(file: string, buf: Buffer) {
    const path = join(MEDIA_DIR, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buf);
  }
  /** Re-create a photo file that is missing from disk (a redeploy without a volume) from the copy in the database. */
  private ensureFile(data: any) {
    if (!data?.file || existsSync(join(MEDIA_DIR, data.file))) return;
    const m = IMAGE_RE.exec(data.image ?? '');
    if (m) this.writeFile(data.file, Buffer.from(m[2], 'base64'));
  }
  private discardFile(data: any) {
    if (!data?.file) return;
    try { unlinkSync(join(MEDIA_DIR, data.file)); } catch { /* already gone */ }
  }
}
