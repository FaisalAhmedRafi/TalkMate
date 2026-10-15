import { Learner } from '../ai/prompts';
import { SentenceSkill, SentenceUnit } from './sentence.catalog';

export const SENTENCES_PER_SESSION = 5;

const LENGTH: Record<string, string> = {
  Beginner: '3 to 8 words each, simple present-tense grammar and very common vocabulary',
  Intermediate: '6 to 12 words each, everyday vocabulary and a few different tenses',
  Advanced: '10 to 18 words each, natural idiomatic phrasing and richer grammar',
};

const JSON_ONLY = 'Return ONLY valid JSON. No markdown, no code fences, no commentary.';

export const sessionSystem = (unit: SentenceUnit, skill: SentenceSkill, l: Learner) =>
  `You write ${l.targetLanguage} speaking-practice sentences for a ${l.level} learner whose native language is ${l.nativeLanguage}. ` +
  `Unit: "${unit.title}". Skill: "${skill.title}" (${skill.description}). ` +
  `Write exactly ${SENTENCES_PER_SESSION} different sentences that a real person would say in this situation, in ${l.targetLanguage}, ` +
  `${LENGTH[l.level] ?? LENGTH.Beginner}. Each must be ONE sentence that is easy to read aloud: ` +
  `no numbering, no quotation marks, no emojis, no romanization or brackets, and end with normal punctuation. ` +
  `Vary the sentences (statements and questions) so they do not repeat each other. ` +
  `translation is in ${l.nativeLanguage}. note is one short tip in ${l.nativeLanguage} about meaning, grammar or usage. ` +
  `${JSON_ONLY} Schema: {"items":[{"sentence":"","translation":"","note":""}]}`;

export const evaluateSystem = (l: Learner) =>
  `You are a kind, precise ${l.targetLanguage} pronunciation coach for a ${l.level} learner whose native language is ${l.nativeLanguage}. ` +
  `You are given the sentence the learner should say, and what a speech recogniser heard them say. ` +
  `Judge how clearly and accurately they said it, based on how closely "heard" matches "target" ` +
  `(ignore capitalisation and punctuation, which a recogniser guesses). ` +
  `Score from 1 to 5: 5 = clear and accurate, 4 = understandable with a small slip, 3 = understandable but several words off, ` +
  `2 = hard to follow, 1 = mostly not matching. Be encouraging. ` +
  `feedback is 1-2 short sentences in ${l.nativeLanguage}. tip is one concrete tip in ${l.nativeLanguage} about the words or sounds to practise ` +
  `(use an empty string if the score is 5). ${JSON_ONLY} Schema: {"score":5,"feedback":"","tip":""}`;
