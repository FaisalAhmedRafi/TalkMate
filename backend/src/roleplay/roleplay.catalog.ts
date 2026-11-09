// The Roleplay Mode types and lookups. The scenarios themselves live in the database, table ContentItem (see src/content).
// The Roleplay Mode scenarios shown on the Roleplays home. Each one is a real-life situation in which the AI plays
// the other person and the learner works through three small tasks.
// The AI speaks the language being learned, so one list serves every language; the scenario and task text is the
// English text on the intro page (and prompt context).
// Scenario ids are URL slugs (/roleplay/saying-hello): never rename one that is already linked or has saved chats.

export const ROLEPLAY_CATEGORIES = ['Social', 'Transport', 'Travel', 'Food', 'Shopping'] as const;
export type RoleplayCategory = (typeof ROLEPLAY_CATEGORIES)[number];

export type RoleplayScenario = {
  id: string;
  title: string;
  /** the pill on the picture in the grid */
  category: RoleplayCategory;
  emoji: string;
  /** search text for the cover photo (also the partner's avatar in the chat) */
  photo: string;
  /** who the learner talks to: shown as the chat name and used in the prompts ("Coworker", "Barista") */
  partner: string;
  partnerEmoji: string;
  /** the situation, written to the learner ("You run into ...") */
  scenario: string;
  /** exactly three things the learner should manage to do during the chat */
  tasks: [string, string, string];
};

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [];

export const findRoleplay = (id: string): RoleplayScenario | undefined => ROLEPLAY_SCENARIOS.find((s) => s.id === id);
