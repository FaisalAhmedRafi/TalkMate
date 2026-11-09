// Everything the content layer knows about the eight content modes: how an element is validated (`normalize`), how stored
// elements fill the live catalog arrays the mode services read on every request (`load`) and how an element is listed in
// the admin table (`rowOf`).
//
// The database (table ContentItem) is the only place content lives. The catalogs (src/<mode>/<mode>.catalog.ts) hold the types,
// the lookups and the live arrays that ContentStore fills from the database; there is no content in the code.

import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CHARACTERS, Character, CharacterKind } from '../characters/characters.catalog';
import { DEBATE_TOPICS } from '../debate/debate.catalog';
import { DIALOGUE_TOPICS, TURNS_PER_DIALOGUE } from '../dialogue/dialogue.catalog';
import { SENTENCE_PHOTO } from '../explore/photo-queries';
import { FLASH_TOPICS } from '../flashcard/flashcard.catalog';
import { PHOTO_UNITS } from '../photo/photo.catalog';
import { ROLEPLAY_CATEGORIES, ROLEPLAY_SCENARIOS, RoleplayCategory } from '../roleplay/roleplay.catalog';
import { SENTENCE_UNITS } from '../sentence/sentence.catalog';
import { WORD_UNITS } from '../word/word.catalog';

export const MODES = ['sentence', 'word', 'flashcards', 'dialogue', 'debate', 'characters', 'roleplay', 'photo'] as const;
export type AdminMode = (typeof MODES)[number];
export const isMode = (v: string): v is AdminMode => (MODES as readonly string[]).includes(v);

export const MODE_LABEL: Record<AdminMode, string> = {
  sentence: 'Sentence', word: 'Word', flashcards: 'Flashcards', dialogue: 'Dialogue',
  debate: 'Debate', characters: 'Characters', roleplay: 'Roleplay', photo: 'Photo',
};

export const CHARACTER_KINDS: CharacterKind[] = ['history', 'myth', 'fiction'];

/** One line of the compact table. */
export type Row = {
  id: string; title: string; sub: string; emoji: string;
  /** unit / category / kind, shown as a small chip and used by the filter */
  group: string; custom: boolean; image?: string | null;
  /** built-in elements only: `edited` = an admin changed it (can be reset), `deleted` = an admin removed it (can be restored) */
  status?: 'edited' | 'deleted';
};

// ---------- small validators ----------
const fail = (m: string): never => { throw new BadRequestException(m); };

function str(v: unknown, label: string, max: number, required = true): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (!s) return required ? fail(`${label} is required.`) : '';
  if (s.length > max) fail(`${label} is too long (max ${max} characters).`);
  return s;
}
/** Free text that may keep line breaks (descriptions). */
function text(v: unknown, label: string, max: number): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return fail(`${label} is required.`);
  if (s.length > max) fail(`${label} is too long (max ${max} characters).`);
  return s;
}
const emoji = (v: unknown) => str(v, 'Emoji', 16);
function int(v: unknown, label: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return n as number;
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function idFrom(label: string, v: string): string {
  const id = slug(v).slice(0, 60);
  return id || fail(`${label} needs at least one letter or digit (a-z, 0-9) to build its web address.`);
}


/** A list typed one item per line (or sent as an array). Empty is fine unless `min` > 0 and something was entered. */
function lines(v: unknown, label: string, min: number, max: number, maxLen: number): string[] {
  const list = (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [])
    .map((x) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : ''))
    .filter(Boolean);
  if (list.length === 0) return [];
  if (list.length < min || list.length > max) fail(`${label}: give ${min} to ${max} lines, one per line (or leave it empty to let the AI write them).`);
  if (list.some((x) => x.length > maxLen)) fail(`${label}: each line can be up to ${maxLen} characters.`);
  return list;
}

/** "Partner: ..." / "You: ..." lines (or an array of { partner, you }) into 3-5 turns. Empty means "let the AI write it". */
export type ScriptTurn = { partner: string; you: string };
function script(v: unknown): ScriptTurn[] {
  if (Array.isArray(v) && v.every((t) => t && typeof t === 'object')) {
    const turns = v.map((t: any) => ({ partner: str(t.partner, 'Partner line', 240), you: str(t.you, 'Your line', 240) }));
    return checkTurns(turns);
  }
  const rows = (typeof v === 'string' ? v.split(/\r?\n/) : []).map((l) => l.trim()).filter(Boolean);
  if (rows.length === 0) return [];
  const turns: ScriptTurn[] = [];
  rows.forEach((l, i) => {
    const m = /^(partner|you)\s*:\s*(.+)$/i.exec(l);
    if (!m) return fail(`Script line ${i + 1} must start with "Partner:" or "You:".`);
    const role = m[1].toLowerCase();
    if (role === 'partner') { if (i % 2 !== 0) fail(`Script line ${i + 1}: lines must alternate Partner, You, Partner, You.`); turns.push({ partner: m[2].trim(), you: '' }); }
    else { if (i % 2 !== 1) fail(`Script line ${i + 1}: lines must alternate Partner, You, Partner, You.`); turns[turns.length - 1].you = m[2].trim(); }
  });
  return checkTurns(turns);
}
function checkTurns(turns: ScriptTurn[]): ScriptTurn[] {
  if (turns.length < 3 || turns.length > TURNS_PER_DIALOGUE || turns.some((t) => !t.partner || !t.you)) {
    fail(`Script: write 3 to ${TURNS_PER_DIALOGUE} turns, each a "Partner:" line followed by a "You:" line.`);
  }
  return turns;
}

/** Optional course id (see COURSES in frontend/lib/courses.ts): the element is added to that course's Learn path. */
function courseId(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return '';
  if (!/^[a-z0-9-]{1,60}$/.test(s)) fail('Course is not valid.');
  return s;
}


/** What the Learn paths need to know about an element that asked to be part of a course (see COURSES in frontend/lib/courses.ts). */
export type CourseItem = { mode: 'sentence' | 'word' | 'dialogue'; id: string; title: string; course: string };

const rev = (d: unknown) => createHash('md5').update(JSON.stringify(d)).digest('hex').slice(0, 8);

/** Existing unit number, or the next free one (which then needs a title). */
function resolveUnit(raw: unknown, numbers: number[], titleRaw: unknown, needsTitle: boolean): { unit: number; unitTitle?: string } {
  const unit = int(raw, 'Unit', 1, 999);
  if (numbers.includes(unit)) return { unit };
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  if (unit !== next) fail(`Unit ${unit} does not exist. Pick an existing unit, or ${next} to start a new one.`);
  return needsTitle ? { unit, unitTitle: str(titleRaw, 'Title for the new unit', 60) } : { unit };
}

// ---------- the per-mode definitions ----------
export type Ctx = { imageUrl: (file: string) => string };
/** An element as stored in ContentItem (`data` is what `normalize` returned). */
export type Stored = { itemId: string; data: any };
/** A table row without the flags the admin service adds (custom, status). */
export type RowBody = Omit<Row, 'custom' | 'status'>;

type Def = {
  /** validate a raw payload and return the data to store (including its `id`); throws BadRequestException */
  normalize(raw: any): any;
  /** rebuild the live catalog from these stored elements (not deleted ones, already in order) */
  load(items: Stored[], ctx: Ctx): void;
  /** the compact table line of one stored element (works for deleted ones too) */
  rowOf(d: any, ctx: Ctx): RowBody;
};

const swap = <T,>(arr: T[], next: T[]) => { arr.splice(0, arr.length, ...next); };

/** Group stored elements into units by `data.unit` (sorted by number). A unit's title is the first `unitTitle` found among its elements. */
function buildUnits<U, I>(items: Stored[], toItem: (d: any, id: string) => I, make: (number: number, title: string, list: I[]) => U): U[] {
  const by = new Map<number, { title: string; list: I[] }>();
  for (const it of items) {
    const n = Number(it.data?.unit);
    if (!Number.isInteger(n)) continue;
    let u = by.get(n);
    if (!u) { u = { title: '', list: [] }; by.set(n, u); }
    if (!u.title && typeof it.data.unitTitle === 'string') u.title = it.data.unitTitle;
    u.list.push(toItem(it.data, it.itemId));
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([n, u]) => make(n, u.title || `Unit ${n}`, u.list));
}
const unitGroup = (units: { number: number; title?: string }[], n: number) => {
  const t = units.find((u) => u.number === n)?.title;
  return t && t !== `Unit ${n}` ? `Unit ${n} · ${t}` : `Unit ${n}`;
};

export const DEFS: Record<AdminMode, Def> = {

  sentence: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 80);
      const u = resolveUnit(raw?.unit, SENTENCE_UNITS.map((x) => x.number), raw?.unitTitle, true);
      return {
        id: idFrom('Title', title), ...u, title, emoji: emoji(raw?.emoji), description: text(raw?.description, 'Description', 200), photo: str(raw?.photo, 'Photo search words', 80, false),
        sentences: lines(raw?.sentences, 'Sentences', 3, 5, 200), course: courseId(raw?.course),
      };
    },
    load: (items) => {
      swap(SENTENCE_UNITS, buildUnits(items, (d, id) => ({ id, title: d.title, emoji: d.emoji, description: d.description, ...(d.sentences?.length ? { sentences: d.sentences } : {}) }),
        (number, title, skills) => ({ number, title, skills })));
      for (const k of Object.keys(SENTENCE_PHOTO)) delete SENTENCE_PHOTO[k];
      for (const it of items) if (it.data.photo) SENTENCE_PHOTO[it.itemId] = it.data.photo;
    },
    rowOf: (d) => ({ id: d.id, title: d.title, sub: d.description, emoji: d.emoji, group: unitGroup(SENTENCE_UNITS, d.unit) }),
  },

  word: {
    normalize: (raw) => {
      const english = str(raw?.english, 'English word', 60);
      const u = resolveUnit(raw?.unit, WORD_UNITS.map((x) => x.number), raw?.unitTitle, true);
      return { id: idFrom('English word', english), ...u, english, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Photo search words', 80, false) || english.replace(/^to /i, ''),
        examples: lines(raw?.examples, 'Example sentences', 1, 3, 200), course: courseId(raw?.course),
      };
    },
    load: (items) => swap(WORD_UNITS, buildUnits(items, (d, id) => ({ id, english: d.english, emoji: d.emoji, photo: d.photo, ...(d.examples?.length ? { examples: d.examples } : {}) }),
      (number, title, words) => ({ number, title, words }))),
    rowOf: (d) => ({ id: d.id, title: d.english, sub: `photo: ${d.photo}`, emoji: d.emoji, group: unitGroup(WORD_UNITS, d.unit) }),
  },

  flashcards: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      return { id: idFrom('Title', title), title, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Cover photo search words', 80), hint: text(raw?.hint, 'Hint (what the 15 words should be)', 240), words: lines(raw?.words, 'Words', 5, 15, 60) };
    },
    load: (items) => swap(FLASH_TOPICS, items.map(({ itemId, data: d }) => ({ id: itemId, title: d.title, emoji: d.emoji, photo: d.photo, hint: d.hint, ...(d.words?.length ? { words: d.words } : {}) }))),
    rowOf: (d) => ({ id: d.id, title: d.title, sub: d.hint, emoji: d.emoji, group: d.words?.length ? `${d.words.length} cards` : '15 cards' }),
  },

  dialogue: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      return {
        id: idFrom('Title', title), title, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Cover photo search words', 80),
        partner: str(raw?.partner, 'Partner', 40), partnerEmoji: emoji(raw?.partnerEmoji), setting: text(raw?.setting, 'Setting', 300),
        script: script(raw?.script), course: courseId(raw?.course),
      };
    },
    load: (items) => swap(DIALOGUE_TOPICS, items.map(({ itemId, data: d }) => ({
      id: itemId, title: d.title, emoji: d.emoji, photo: d.photo, partner: d.partner, partnerEmoji: d.partnerEmoji, setting: d.setting,
      ...(d.script?.length ? { script: d.script } : {}), rev: rev(d), // rev: a changed text must not serve the old cached script
    }))),
    rowOf: (d) => ({ id: d.id, title: d.title, sub: `${d.partner} · ${d.setting}`, emoji: d.emoji, group: d.partner }),
  },

  debate: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      return { id: idFrom('Title', title), title, emoji: emoji(raw?.emoji), statement: text(raw?.statement, 'Statement', 240), photo: str(raw?.photo, 'Cover photo search words', 80) };
    },
    load: (items) => swap(DEBATE_TOPICS, items.map(({ itemId, data: d }) => ({ id: itemId, title: d.title, statement: d.statement, emoji: d.emoji, photo: d.photo }))),
    rowOf: (d) => ({ id: d.id, title: d.title, sub: d.statement, emoji: d.emoji, group: 'Debate' }),
  },

  characters: {
    normalize: (raw) => {
      const name = str(raw?.name, 'Name', 60);
      const kind = String(raw?.kind ?? '').trim().toLowerCase();
      if (!CHARACTER_KINDS.includes(kind as CharacterKind)) fail(`Kind must be one of: ${CHARACTER_KINDS.join(', ')}.`);
      return { id: idFrom('Name', name), name, emoji: emoji(raw?.emoji), hue: int(raw?.hue ?? 210, 'Colour hue', 0, 360), kind, about: text(raw?.about, 'About (persona)', 600) };
    },
    // a picture uploaded in the admin panel (`file`) becomes the portrait; without one the Wikipedia picture is used (CharacterPhotoService)
    load: (items, ctx) => swap(CHARACTERS, items.map(({ itemId, data: d }) => ({
      id: itemId, name: d.name, emoji: d.emoji, hue: d.hue, kind: d.kind, about: d.about, ...(d.file ? { portrait: ctx.imageUrl(d.file) } : {}),
    }) as Character)),
    rowOf: (d, ctx) => ({ id: d.id, title: d.name, sub: d.about, emoji: d.emoji, group: d.kind, image: d.file ? ctx.imageUrl(d.file) : null }),
  },

  roleplay: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      const category = str(raw?.category, 'Category', 20);
      const found = ROLEPLAY_CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
      if (!found) fail(`Category must be one of: ${ROLEPLAY_CATEGORIES.join(', ')}.`);
      const tasks = Array.isArray(raw?.tasks) ? raw.tasks.map((t: unknown) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean) : [];
      if (tasks.length !== 3 || tasks.some((t: string) => t.length > 140)) fail('Give exactly three tasks (each up to 140 characters).');
      return {
        id: idFrom('Title', title), title, category: found, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Cover photo search words', 80),
        partner: str(raw?.partner, 'Partner', 40), partnerEmoji: emoji(raw?.partnerEmoji), scenario: text(raw?.scenario, 'Scenario', 400), tasks,
      };
    },
    load: (items) => swap(ROLEPLAY_SCENARIOS, items.map(({ itemId, data: d }) => ({
      id: itemId, title: d.title, category: d.category as RoleplayCategory, emoji: d.emoji, photo: d.photo,
      partner: d.partner, partnerEmoji: d.partnerEmoji, scenario: d.scenario, tasks: d.tasks as [string, string, string],
    }))),
    rowOf: (d) => ({ id: d.id, title: d.title, sub: d.scenario, emoji: d.emoji, group: d.category }),
  },

  photo: {
    // `image` (a data URL) is checked and saved to disk by AdminService; here we only validate the unit.
    normalize: (raw) => {
      const u = resolveUnit(raw?.unit, PHOTO_UNITS.map((x) => x.number), undefined, false);
      return { ...u };
    },
    // built-in photos have `url` (a path in the FRONTEND's public folder); an uploaded one has `file` (in the media folder)
    load: (items, ctx) => swap(PHOTO_UNITS, buildUnits(items.filter((i) => i.data.file || i.data.url),
      (d, id) => ({ id, image: d.file ? ctx.imageUrl(d.file) : d.url as string }), (number, _title, photos) => ({ number, photos }))),
    rowOf: (d, ctx) => ({
      id: d.id, title: `Photo ${String(d.id).replace('photo-', '')}`, sub: d.file ? 'uploaded in the admin panel' : String(d.url ?? ''), emoji: '🖼️',
      group: `Unit ${d.unit}`, image: d.file ? ctx.imageUrl(d.file) : d.url ?? null,
    }),
  },
};

/** Unit list for the forms of the modes that have units. */
export function unitsOf(mode: AdminMode): { number: number; title: string }[] | undefined {
  if (mode === 'sentence') return SENTENCE_UNITS.map((u) => ({ number: u.number, title: u.title }));
  if (mode === 'word') return WORD_UNITS.map((u) => ({ number: u.number, title: u.title }));
  if (mode === 'photo') return PHOTO_UNITS.map((u) => ({ number: u.number, title: `Unit ${u.number}` }));
  return undefined;
}

/** photo-<n> where n is one more than the largest number among `ids`: pass the ids of every photo row, deleted ones included, because learners' progress rows still carry them. */
export function nextPhotoId(ids: Iterable<string>): string {
  const used = [...ids].map((id) => Number(id.replace('photo-', '')) || 0);
  return `photo-${(used.length ? Math.max(...used) : 0) + 1}`;
}
