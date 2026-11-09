// The Dialogue Mode types and lookups. The topics themselves live in the database, table ContentItem (see src/content).
// The Dialogue Mode topics shown on the Dialogue home. Each topic is one short scripted conversation.
// The AI writes the lines in the language being learned, so one list serves every language.
// Topic ids are URL slugs (/dialogue/at-a-restaurant): never rename one that is already linked or bookmarked.

export type DialogueTopic = {
  id: string;
  title: string;
  emoji: string;
  /** search text for the cover photo (a scene, not people, to match the illustrated look of the grid) */
  photo: string;
  /** who the learner talks to (shown under the avatar) */
  partner: string;
  partnerEmoji: string;
  /** prompt context: where the conversation happens */
  setting: string;
  /** optional English script written by an admin (the AI translates it); `rev` changes whenever it is edited, to bypass the script cache */
  script?: { partner: string; you: string }[];
  rev?: string;
};

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const DIALOGUE_TOPICS: DialogueTopic[] = [];

export const findDialogue = (id: string): DialogueTopic | undefined => DIALOGUE_TOPICS.find((t) => t.id === id);

/** Every dialogue has this many turns (the partner speaks, then the learner answers). */
export const TURNS_PER_DIALOGUE = 5;
