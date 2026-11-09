// The Debate Mode types and lookups. The topics themselves live in the database, table ContentItem (see src/content).
// The Debate Mode topics shown on the Debates home. Each one is a statement the learner argues for or against.
// The AI writes everything in the language being learned, so one list serves every language; the statement is
// only prompt context and the English text on the intro page.
// Topic ids are URL slugs (/debate/fast-food): never rename one that is already linked or bookmarked.

export type DebateTopic = {
  id: string;
  title: string;
  /** the claim, shown on the intro page ("Argue for" agrees with it, "Argue against" disagrees) */
  statement: string;
  emoji: string;
  /** search text for the cover photo (a scene, not people, to match the illustrated look of the grid) */
  photo: string;
};

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const DEBATE_TOPICS: DebateTopic[] = [];

export const findDebate = (id: string): DebateTopic | undefined => DEBATE_TOPICS.find((t) => t.id === id);

export const DEBATE_SIDES = ['for', 'against'] as const;
export type DebateSide = (typeof DEBATE_SIDES)[number];

/** The AI debates the learner, so it always takes the other side. */
export const opposite = (side: DebateSide): DebateSide => (side === 'for' ? 'against' : 'for');

/** The AI teacher the learner debates with (name and avatar are shown in the chat header). */
export const TEACHER = { name: 'Kai', emoji: '🧑‍🏫' };
