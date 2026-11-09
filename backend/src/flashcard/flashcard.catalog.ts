// The Flashcards types and lookups. The topics themselves live in the database, table ContentItem (see src/content).
// The Flashcards topics shown on the Flashcards home. Each topic is one deck of CARDS_PER_DECK words.
// The AI writes the words in the language being learned, so one list serves every language.
// Topic ids are URL slugs (/flashcards/people) and the keys stored in FlashcardDeck: never rename one
// that users already have a deck for.

/** `words`: optional English word list (5 to 15) written by an admin; the deck is then exactly those words instead of 15 chosen by the AI. */
export type FlashTopic = { id: string; title: string; emoji: string; photo: string; hint: string; words?: string[] };
/** Cards in a deck: the admin's own word list when there is one, else CARDS_PER_DECK. */
export const deckSize = (t: FlashTopic) => t.words?.length || CARDS_PER_DECK;

/** Every deck has this many cards. */
export const CARDS_PER_DECK = 15;

/** The catalog the service reads on every request. It starts empty and ContentStore (src/content) fills it from the database when the API starts and after every change. */
export const FLASH_TOPICS: FlashTopic[] = [];

export const findTopic = (id: string): FlashTopic | undefined => FLASH_TOPICS.find((t) => t.id === id);
