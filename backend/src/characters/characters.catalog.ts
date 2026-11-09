// The Characters Mode types and lookups. The roster itself lives in the database, table ContentItem (see src/content).
// The Characters Mode roster. The learner picks one and chats with an AI playing that character in the language being learned.
// Character ids are URL slugs (/characters/loki) and the keys stored in `CharacterSession`: never rename one that users
// have a conversation with. The AI writes everything in the learner's language, so one list serves every language;
// `about` is English prompt context and the text on the intro page.

export type CharacterKind = 'history' | 'myth' | 'fiction';

export type Character = {
  id: string;
  name: string;
  /** shown on the tile when there is no portrait image in frontend/public/characters */
  emoji: string;
  /** colour (0-360 hue) of that fallback tile; the frontend builds the gradient from it */
  hue: number;
  kind: CharacterKind;
  /** who they are, how they talk and what they like to talk about: the persona the AI plays */
  about: string;
  /** picture URL uploaded in the Admin panel; wins over the Wikipedia picture */
  portrait?: string;
};

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const CHARACTERS: Character[] = [];

export const findCharacter = (id: string): Character | undefined => CHARACTERS.find((c) => c.id === id);
