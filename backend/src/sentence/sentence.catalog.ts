// The Sentence Mode types and lookups. The content (units and skills) lives in the database, table ContentItem (see src/content).
// Skill ids are URL slugs (/sentence/<id>), so never rename one once users have progress on it.

/** `sentences`: optional English lines written by an admin; when present the AI translates them instead of inventing its own. */
export type SentenceSkill = { id: string; title: string; description: string; emoji: string; sentences?: string[] };
export type SentenceUnit = { number: number; title: string; skills: SentenceSkill[] };

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const SENTENCE_UNITS: SentenceUnit[] = [];

// A function, not a constant: the admin panel adds skills at runtime (see src/admin).
export const totalSkills = () => SENTENCE_UNITS.reduce((n, u) => n + u.skills.length, 0);

export function findSkill(id: string): { unit: SentenceUnit; skill: SentenceSkill } | null {
  for (const unit of SENTENCE_UNITS) {
    const skill = unit.skills.find((k) => k.id === id);
    if (skill) return { unit, skill };
  }
  return null;
}
