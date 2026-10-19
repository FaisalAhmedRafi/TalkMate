import { Learner } from '../ai/prompts';
import { CARDS_PER_DECK, FlashTopic } from './flashcard.catalog';

const LENGTH: Record<string, string> = {
  Beginner: 'very common beginner words; the example has 3 to 7 words and simple present tense',
  Intermediate: 'everyday words, some less obvious; the example has 6 to 11 words',
  Advanced: 'richer or more precise words; the example has 9 to 16 words and natural phrasing',
};

/** Ask for `count` more cards; `exclude` lists terms already in the deck so a top-up request does not repeat them. */
export const deckSystem = (topic: FlashTopic, l: Learner, count: number = CARDS_PER_DECK, exclude: string[] = []) =>
  `You write ${l.targetLanguage} vocabulary flashcards for a ${l.level} learner whose native language is ${l.nativeLanguage}. ` +
  `Topic: "${topic.title}" (${topic.hint}). Write exactly ${count} different single words that fit this topic: ${LENGTH[l.level] ?? LENGTH.Beginner}. ` +
  `term is the ${l.targetLanguage} word in dictionary form: for languages whose nouns take an article or gender marker, include it ` +
  `(for example \"der Junge\" or \"la casa\"); verbs are in the infinitive. translation is its short meaning in ${l.nativeLanguage} (1 to 3 words). ` +
  `example is ONE natural sentence in ${l.targetLanguage} that uses the word (in any correct form), easy to read aloud: no numbering, ` +
  `no quotation marks, no emojis, no romanization or brackets, ending with normal punctuation. exampleTranslation is that sentence in ${l.nativeLanguage}. ` +
  `photo is 2 to 4 ENGLISH words that would find a clear, concrete stock photo of the word (for example \"boy standing in park\"); never abstract, never text. ` +
  (exclude.length ? `Do NOT use any of these words: ${exclude.join(', ')}. ` : '') +
  `Return ONLY valid JSON. No markdown, no code fences, no commentary. ` +
  `Schema: {\"cards\":[{\"term\":\"\",\"translation\":\"\",\"example\":\"\",\"exampleTranslation\":\"\",\"photo\":\"\"}]}`;
