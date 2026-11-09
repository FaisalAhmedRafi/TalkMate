// The Word Mode types and lookups. The words themselves live in the database, table ContentItem (see src/content).
// Each entry is an English *concept*. The AI turns it into the word in the language being learned
// (with its article, for languages that have one), so one list serves every language.
// Word ids are URL slugs (/word/friend) and the keys stored in WordProgress: never rename one that
// users have progress on.

/** `examples`: optional English sentences (up to 3) written by an admin; the AI translates them and writes the rest. */
export type WordItem = { id: string; english: string; emoji: string; photo: string; examples?: string[] };
export type WordUnit = { number: number; title: string; words: WordItem[] };

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const WORD_UNITS: WordUnit[] = [];

export const WORDS_PER_UNIT = 12;
// A function, not a constant: the admin panel adds words at runtime (see src/admin).
export const totalWords = () => WORD_UNITS.reduce((n, u) => n + u.words.length, 0);

export function findWord(id: string): { unit: WordUnit; word: WordItem } | null {
  for (const unit of WORD_UNITS) {
    const word = unit.words.find((x) => x.id === id);
    if (word) return { unit, word };
  }
  return null;
}
