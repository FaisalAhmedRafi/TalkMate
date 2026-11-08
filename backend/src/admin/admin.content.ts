// Everything the admin panel knows about the eight content modes: how an element is validated, how it is
// listed in the compact table, and how it is pushed into the built-in catalog the mode already reads.
//
// The catalogs (src/<mode>/<mode>.catalog.ts) are plain arrays that the mode services read on every request, so
// custom elements are added to those same arrays in place (and removed again on delete). No mode service had to
// learn about the database.

import { BadRequestException } from '@nestjs/common';
import { CHARACTERS, Character, CharacterKind } from '../characters/characters.catalog';
import { DEBATE_TOPICS } from '../debate/debate.catalog';
import { DIALOGUE_TOPICS } from '../dialogue/dialogue.catalog';
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

/** Existing unit number, or the next free one (which then needs a title). */
function resolveUnit(raw: unknown, numbers: number[], titleRaw: unknown, needsTitle: boolean): { unit: number; unitTitle?: string } {
  const unit = int(raw, 'Unit', 1, 999);
  if (numbers.includes(unit)) return { unit };
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  if (unit !== next) fail(`Unit ${unit} does not exist. Pick an existing unit, or ${next} to start a new one.`);
  return needsTitle ? { unit, unitTitle: str(titleRaw, 'Title for the new unit', 60) } : { unit };
}

// ---------- the per-mode definitions ----------
type Def = {
  /** validate a raw payload and return the data to store (including its `id`); throws BadRequestException */
  normalize(raw: any): any;
  /** put a stored item into the live catalog */
  add(d: any, ctx: { imageUrl: (file: string) => string }): void;
  /** take every custom item out of the live catalog again */
  clear(): void;
  /** the compact table, built-in and custom together */
  rows(isCustom: (id: string) => boolean, ctx: { imageUrl: (file: string) => string }): Row[];
  /** every id currently in the live catalog, to reject duplicates */
  ids(): string[];
};

// Units created by the admin panel are removed again on clear(); remember which they are.
const createdUnits: Record<'sentence' | 'word' | 'photo', Set<number>> = { sentence: new Set(), word: new Set(), photo: new Set() };

function removeFromUnits<U extends { number: number }>(units: U[], kind: 'sentence' | 'word' | 'photo', items: (u: U) => any[], isCustom: (x: any) => boolean) {
  for (const u of units) {
    const list = items(u);
    for (let i = list.length - 1; i >= 0; i--) if (isCustom(list[i])) list.splice(i, 1);
  }
  for (let i = units.length - 1; i >= 0; i--) if (createdUnits[kind].has(units[i].number) && items(units[i]).length === 0) units.splice(i, 1);
  createdUnits[kind].clear();
}
function unitFor<U extends { number: number }>(units: U[], kind: 'sentence' | 'word' | 'photo', d: any, make: () => U): U {
  let u = units.find((x) => x.number === d.unit);
  if (!u) { u = make(); units.push(u); units.sort((a, b) => a.number - b.number); createdUnits[kind].add(d.unit); }
  return u;
}

const customSentence = new Set<string>();
const customWord = new Set<string>();
const customPhoto = new Set<string>();
const customFlash = new Set<string>();
const customDialogue = new Set<string>();
const customDebate = new Set<string>();
const customCharacter = new Set<string>();
const customRoleplay = new Set<string>();

function dropFrom<T extends { id: string }>(arr: T[], ids: Set<string>) {
  for (let i = arr.length - 1; i >= 0; i--) if (ids.has(arr[i].id)) arr.splice(i, 1);
  ids.clear();
}

export const DEFS: Record<AdminMode, Def> = {
  sentence: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 80);
      const u = resolveUnit(raw?.unit, SENTENCE_UNITS.map((x) => x.number), raw?.unitTitle, true);
      return { id: idFrom('Title', title), ...u, title, emoji: emoji(raw?.emoji), description: text(raw?.description, 'Description', 200), photo: str(raw?.photo, 'Photo search words', 80, false) };
    },
    add: (d) => {
      const u = unitFor(SENTENCE_UNITS, 'sentence', d, () => ({ number: d.unit, title: d.unitTitle || `Unit ${d.unit}`, skills: [] }));
      u.skills.push({ id: d.id, title: d.title, emoji: d.emoji, description: d.description });
      if (d.photo) SENTENCE_PHOTO[d.id] = d.photo;
      customSentence.add(d.id);
    },
    clear: () => {
      for (const id of customSentence) delete SENTENCE_PHOTO[id];
      removeFromUnits(SENTENCE_UNITS, 'sentence', (u) => u.skills, (k) => customSentence.has(k.id));
      customSentence.clear();
    },
    rows: (isCustom) => SENTENCE_UNITS.flatMap((u) => u.skills.map((k) => ({
      id: k.id, title: k.title, sub: k.description, emoji: k.emoji, group: `Unit ${u.number} · ${u.title}`, custom: isCustom(k.id),
    }))),
    ids: () => SENTENCE_UNITS.flatMap((u) => u.skills.map((k) => k.id)),
  },

  word: {
    normalize: (raw) => {
      const english = str(raw?.english, 'English word', 60);
      const u = resolveUnit(raw?.unit, WORD_UNITS.map((x) => x.number), raw?.unitTitle, true);
      return { id: idFrom('English word', english), ...u, english, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Photo search words', 80, false) || english.replace(/^to /i, '') };
    },
    add: (d) => {
      const u = unitFor(WORD_UNITS, 'word', d, () => ({ number: d.unit, title: d.unitTitle || `Unit ${d.unit}`, words: [] }));
      u.words.push({ id: d.id, english: d.english, emoji: d.emoji, photo: d.photo });
      customWord.add(d.id);
    },
    clear: () => { removeFromUnits(WORD_UNITS, 'word', (u) => u.words, (w) => customWord.has(w.id)); customWord.clear(); },
    rows: (isCustom) => WORD_UNITS.flatMap((u) => u.words.map((w) => ({
      id: w.id, title: w.english, sub: `photo: ${w.photo}`, emoji: w.emoji, group: `Unit ${u.number} · ${u.title}`, custom: isCustom(w.id),
    }))),
    ids: () => WORD_UNITS.flatMap((u) => u.words.map((w) => w.id)),
  },

  flashcards: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      return { id: idFrom('Title', title), title, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Cover photo search words', 80), hint: text(raw?.hint, 'Hint (what the 15 words should be)', 240) };
    },
    add: (d) => { FLASH_TOPICS.push({ id: d.id, title: d.title, emoji: d.emoji, photo: d.photo, hint: d.hint }); customFlash.add(d.id); },
    clear: () => dropFrom(FLASH_TOPICS, customFlash),
    rows: (isCustom) => FLASH_TOPICS.map((t) => ({ id: t.id, title: t.title, sub: t.hint, emoji: t.emoji, group: '15 cards', custom: isCustom(t.id) })),
    ids: () => FLASH_TOPICS.map((t) => t.id),
  },

  dialogue: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      return {
        id: idFrom('Title', title), title, emoji: emoji(raw?.emoji), photo: str(raw?.photo, 'Cover photo search words', 80),
        partner: str(raw?.partner, 'Partner', 40), partnerEmoji: emoji(raw?.partnerEmoji), setting: text(raw?.setting, 'Setting', 300),
      };
    },
    add: (d) => {
      DIALOGUE_TOPICS.push({ id: d.id, title: d.title, emoji: d.emoji, photo: d.photo, partner: d.partner, partnerEmoji: d.partnerEmoji, setting: d.setting });
      customDialogue.add(d.id);
    },
    clear: () => dropFrom(DIALOGUE_TOPICS, customDialogue),
    rows: (isCustom) => DIALOGUE_TOPICS.map((t) => ({ id: t.id, title: t.title, sub: `${t.partner} · ${t.setting}`, emoji: t.emoji, group: t.partner, custom: isCustom(t.id) })),
    ids: () => DIALOGUE_TOPICS.map((t) => t.id),
  },

  debate: {
    normalize: (raw) => {
      const title = str(raw?.title, 'Title', 60);
      return { id: idFrom('Title', title), title, emoji: emoji(raw?.emoji), statement: text(raw?.statement, 'Statement', 240), photo: str(raw?.photo, 'Cover photo search words', 80) };
    },
    add: (d) => { DEBATE_TOPICS.push({ id: d.id, title: d.title, statement: d.statement, emoji: d.emoji, photo: d.photo }); customDebate.add(d.id); },
    clear: () => dropFrom(DEBATE_TOPICS, customDebate),
    rows: (isCustom) => DEBATE_TOPICS.map((t) => ({ id: t.id, title: t.title, sub: t.statement, emoji: t.emoji, group: 'Debate', custom: isCustom(t.id) })),
    ids: () => DEBATE_TOPICS.map((t) => t.id),
  },

  characters: {
    normalize: (raw) => {
      const name = str(raw?.name, 'Name', 60);
      const kind = String(raw?.kind ?? '').trim().toLowerCase();
      if (!CHARACTER_KINDS.includes(kind as CharacterKind)) fail(`Kind must be one of: ${CHARACTER_KINDS.join(', ')}.`);
      return { id: idFrom('Name', name), name, emoji: emoji(raw?.emoji), hue: int(raw?.hue ?? 210, 'Colour hue', 0, 360), kind, about: text(raw?.about, 'About (persona)', 600) };
    },
    add: (d) => { CHARACTERS.push({ id: d.id, name: d.name, emoji: d.emoji, hue: d.hue, kind: d.kind, about: d.about } as Character); customCharacter.add(d.id); },
    clear: () => dropFrom(CHARACTERS, customCharacter),
    rows: (isCustom) => CHARACTERS.map((c) => ({ id: c.id, title: c.name, sub: c.about, emoji: c.emoji, group: c.kind, custom: isCustom(c.id) })),
    ids: () => CHARACTERS.map((c) => c.id),
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
    add: (d) => {
      ROLEPLAY_SCENARIOS.push({
        id: d.id, title: d.title, category: d.category as RoleplayCategory, emoji: d.emoji, photo: d.photo,
        partner: d.partner, partnerEmoji: d.partnerEmoji, scenario: d.scenario, tasks: d.tasks as [string, string, string],
      });
      customRoleplay.add(d.id);
    },
    clear: () => dropFrom(ROLEPLAY_SCENARIOS, customRoleplay),
    rows: (isCustom) => ROLEPLAY_SCENARIOS.map((s) => ({ id: s.id, title: s.title, sub: s.scenario, emoji: s.emoji, group: s.category, custom: isCustom(s.id) })),
    ids: () => ROLEPLAY_SCENARIOS.map((s) => s.id),
  },

  photo: {
    // `image` (a data URL) is checked and saved to disk by AdminService; here we only validate the unit.
    normalize: (raw) => {
      const u = resolveUnit(raw?.unit, PHOTO_UNITS.map((x) => x.number), undefined, false);
      return { ...u };
    },
    add: (d, ctx) => {
      const u = unitFor(PHOTO_UNITS, 'photo', d, () => ({ number: d.unit, photos: [] }));
      u.photos.push({ id: d.id, image: ctx.imageUrl(d.file) });
      customPhoto.add(d.id);
    },
    clear: () => { removeFromUnits(PHOTO_UNITS, 'photo', (u) => u.photos, (p) => customPhoto.has(p.id)); customPhoto.clear(); },
    rows: (isCustom) => PHOTO_UNITS.flatMap((u) => u.photos.map((p) => ({
      id: p.id, title: p.id.replace('photo-', 'Photo '), sub: p.image.startsWith('http') ? 'uploaded in the admin panel' : p.image, emoji: '🖼️',
      group: `Unit ${u.number}`, custom: isCustom(p.id), image: p.image,
    }))),
    ids: () => PHOTO_UNITS.flatMap((u) => u.photos.map((p) => p.id)),
  },
};

/** Unit list for the forms of the modes that have units. */
export function unitsOf(mode: AdminMode): { number: number; title: string }[] | undefined {
  if (mode === 'sentence') return SENTENCE_UNITS.map((u) => ({ number: u.number, title: u.title }));
  if (mode === 'word') return WORD_UNITS.map((u) => ({ number: u.number, title: u.title }));
  if (mode === 'photo') return PHOTO_UNITS.map((u) => ({ number: u.number, title: `Unit ${u.number}` }));
  return undefined;
}

/** photo-<n> where n is one more than the largest number in use (built-in or custom). */
export function nextPhotoId(): string {
  const used = PHOTO_UNITS.flatMap((u) => u.photos.map((p) => Number(p.id.replace('photo-', '')) || 0));
  return `photo-${(used.length ? Math.max(...used) : 0) + 1}`;
}
