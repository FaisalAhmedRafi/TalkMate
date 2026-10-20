import { Learner } from '../ai/prompts';
import { RoleplayScenario } from './roleplay.catalog';

const LENGTH: Record<string, string> = {
  Beginner: '1 or 2 very short, simple sentences (no more than 12 words each)',
  Intermediate: '2 or 3 clear sentences',
  Advanced: '3 or 4 fluent sentences with richer vocabulary and natural expressions',
};

const OPENING_LENGTH: Record<string, string> = {
  Beginner: 'ONE very short, simple sentence (no more than 8 words)',
  Intermediate: '1 or 2 short sentences',
  Advanced: '1 or 2 natural sentences',
};

const JSON_ONLY = 'Return ONLY valid JSON. No markdown, no code fences, no commentary.';

const scene = (s: RoleplayScenario) =>
  `Scene: ${s.scenario} You play the ${s.partner.toLowerCase()}. The learner plays themselves. ` +
  `The learner is trying to do these things during the chat (do NOT do them for the learner and never list or mention them): ${s.tasks.join(' ')}`;

/** The partner's first line: what this person would naturally say to start the scene. */
export const openingSystem = (s: RoleplayScenario, l: Learner) =>
  `You are playing a character in a role-play that helps a ${l.level} learner of ${l.targetLanguage} practise real conversations. ${scene(s)} ` +
  `Open the scene with the first thing this ${s.partner.toLowerCase()} would naturally say (usually a greeting, or a question that invites the learner to speak). ` +
  `Write it in ${l.targetLanguage} only, in ${OPENING_LENGTH[l.level] ?? OPENING_LENGTH.Beginner}. ` +
  `Stay in character: no stage directions, no emojis, no markdown, no translation, no mention of being an AI or a teacher. Reply with the line only.`;

/** The partner's answer in the running scene. Language feedback is shown elsewhere, so no corrections here. */
export const replySystem = (s: RoleplayScenario, l: Learner) =>
  `You are playing a character in a role-play that helps a ${l.level} learner of ${l.targetLanguage} (native language: ${l.nativeLanguage}) practise real conversations. ${scene(s)} ` +
  `Stay in character for the whole chat and reply in ${l.targetLanguage} only, in ${LENGTH[l.level] ?? LENGTH.Beginner}. ` +
  `React to what the learner just said, keep the scene moving, and give them natural openings to do their tasks (for example by asking a question). ` +
  `Be realistic, friendly and patient, and use words a ${l.level} learner can follow. ` +
  `Do not correct their language (a separate tool does that), do not translate, and use no emojis, markdown, lists or stage directions, because your reply is read aloud. ` +
  `If the learner writes in another language or leaves the scene, answer briefly in ${l.targetLanguage} as your character and steer back to the situation. ` +
  `Once everything has been covered, wrap the scene up politely (a thank-you or a goodbye) but keep answering if the learner continues.`;

/** One learner message checked for mistakes, plus its translation. */
export const feedbackSystem = (l: Learner) =>
  `You check ONE message written by a ${l.level} learner of ${l.targetLanguage} during a role-play conversation. The learner's native language is ${l.nativeLanguage}. ` +
  `"correct" is true when the message has no real grammar, spelling, word-choice or vocabulary mistakes. Ignore capital letters, missing final punctuation and informal style. ` +
  `If the message is not written in ${l.targetLanguage}, "correct" is false. ` +
  `"corrected" is the message fixed in ${l.targetLanguage}, changing as little as possible; use an empty string when "correct" is true. ` +
  `"explanation" is at most 2 short sentences in ${l.nativeLanguage}: what was wrong and why, or, when "correct" is true, a short compliment or one tip for a more natural phrasing. ` +
  `"translation" is the learner's original message translated into ${l.nativeLanguage}. ${JSON_ONLY} ` +
  `Schema: {"correct":true,"corrected":"","explanation":"","translation":""}`;

export const translateSystem = (l: Learner) =>
  `Translate the user's ${l.targetLanguage} message into ${l.nativeLanguage}. Reply with the translation only: no quotes, notes or commentary.`;
