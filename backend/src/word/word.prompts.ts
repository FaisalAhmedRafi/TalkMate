import { Learner } from '../ai/prompts';
import { WordItem, WordUnit } from './word.catalog';

/** One word card, then this many sentences (the progress bar in the UI has SENTENCES_PER_WORD + 1 stops). */
export const SENTENCES_PER_WORD = 3;

const LENGTH: Record<string, string> = {
  Beginner: '3 to 8 words each, simple present-tense grammar and very common vocabulary',
  Intermediate: '6 to 12 words each, everyday vocabulary and a few different tenses',
  Advanced: '10 to 18 words each, natural idiomatic phrasing and richer grammar',
};

export const lessonSystem = (item: WordItem, unit: WordUnit, l: Learner) =>
  `You write ${l.targetLanguage} vocabulary lessons for a ${l.level} learner whose native language is ${l.nativeLanguage}. ` +
  `The concept is "${item.english}" (unit theme: ${unit.title}). ` +
  `word is the ${l.targetLanguage} word for it in dictionary form: for languages whose nouns take an article or gender marker, include it ` +
  `(for example "der Freund" or "la casa"); verbs are in the infinitive. translation is its short meaning in ${l.nativeLanguage}. ` +
  `Then write exactly ${SENTENCES_PER_WORD} different natural sentences in ${l.targetLanguage} that each use this word (in any correct grammatical form), ` +
  `${LENGTH[l.level] ?? LENGTH.Beginner}. Each must be ONE sentence that is easy to read aloud: no numbering, no quotation marks, ` +
  `no emojis, no romanization or brackets, ending with normal punctuation. ` +
  `For every sentence give: translation in ${l.nativeLanguage}; note, one short tip in ${l.nativeLanguage}; and chunks, 2 to 3 consecutive pieces ` +
  `that together cover the sentence in order, each with text (copied exactly from the sentence), meaning (in ${l.nativeLanguage}) ` +
  `and explanation (1-2 short sentences in ${l.nativeLanguage} about its grammar or use). ` +
  `Return ONLY valid JSON. No markdown, no code fences, no commentary. ` +
  `Schema: {"word":"","translation":"","sentences":[{"sentence":"","translation":"","note":"","chunks":[{"text":"","meaning":"","explanation":""}]}]}`;
