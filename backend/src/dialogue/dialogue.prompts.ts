import { Learner } from '../ai/prompts';
import { DialogueTopic, TURNS_PER_DIALOGUE } from './dialogue.catalog';

const LENGTH: Record<string, string> = {
  Beginner: 'very simple present-tense sentences of 3 to 8 words',
  Intermediate: 'natural everyday sentences of 6 to 12 words',
  Advanced: 'fluent, natural sentences of 9 to 16 words with richer vocabulary',
};

/** One scripted conversation: the partner speaks first, the learner answers, TURNS_PER_DIALOGUE times. */
export const dialogueSystem = (topic: DialogueTopic, l: Learner) =>
  `You write short scripted ${l.targetLanguage} conversations for a ${l.level} learner whose native language is ${l.nativeLanguage}. ` +
  `Topic: "${topic.title}" (${topic.setting}). The learner talks to a ${topic.partner.toLowerCase()}. ` +
  `Write exactly ${TURNS_PER_DIALOGUE} turns. In every turn the ${topic.partner.toLowerCase()} speaks first (partner), then the learner answers (you). ` +
  `The conversation must flow naturally from one turn to the next, start with a greeting or an opening question, and end politely. ` +
  `Use ${LENGTH[l.level] ?? LENGTH.Beginner}. Every "you" line is read aloud by the learner, so it must be easy to say: ` +
  `no numbering, no quotation marks, no emojis, no romanization, no brackets, ending with normal punctuation. ` +
  `partnerTranslation and youTranslation are the lines in ${l.nativeLanguage}. title is a short title in ${l.targetLanguage}. ` +
  `Return ONLY valid JSON. No markdown, no code fences, no commentary. ` +
  `Schema: {"title":"","turns":[{"partner":"","partnerTranslation":"","you":"","youTranslation":""}]}`;
