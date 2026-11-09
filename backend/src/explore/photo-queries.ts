// Search words for the stock photo shown on Sentence Mode lessons in Explore. They are stored with each skill in the database
// (ContentItem.data.photo): keep queries short and concrete, stock sites match single objects and places better than ideas.
// A skill without words keeps its emoji tile. (Characters use real pictures from Wikipedia, see characters/characters.photos.ts.)

/** skill id -> search words. Starts empty; ContentStore (src/content) fills it from the database. */
export const SENTENCE_PHOTO: Record<string, string> = {};
