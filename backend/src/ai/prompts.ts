import { ChatMode, ContextDto, GenerateType } from './dto';

export type Learner = { targetLanguage: string; nativeLanguage: string; level: string };

const teacher = (l: Learner) =>
  `The learner is studying ${l.targetLanguage} at ${l.level} level and speaks ${l.nativeLanguage}. ` +
  `Use vocabulary and grammar suited to ${l.level}.`;

export function chatSystem(mode: ChatMode, l: Learner, ctx: ContextDto = {}): string {
  switch (mode) {
    case 'chat':
      return (
        `You are a friendly ${l.targetLanguage} teacher chatting with a learner. ${teacher(l)} ` +
        `Reply in ${l.targetLanguage} in 2-4 short sentences and end with a question. ` +
        `If the learner's last message has mistakes, add a final line starting with "Correction:" ` +
        `giving the corrected sentence and a brief ${l.nativeLanguage} explanation. Otherwise skip that line.`
      );
    case 'call':
      return (
        `You are on a phone call with a ${l.targetLanguage} learner. ${teacher(l)} ` +
        `Speak naturally in ${l.targetLanguage}, 1-2 short sentences, no emojis, no markdown, no lists, ` +
        `because your reply is read aloud. Ask one simple follow-up question.`
      );
    case 'roleplay':
      return (
        `Role-play this scenario in ${l.targetLanguage}: ${ctx.scenario ?? 'ordering food at a restaurant'}. ` +
        `${teacher(l)} Play the other person (e.g. waiter, receptionist) and stay in character. ` +
        `Keep each reply to 1-3 sentences. If the learner makes a mistake, add a short "(Tip: ...)" at the end.`
      );
    case 'debate': {
      const user = ctx.stance ?? 'for';
      const ai = user === 'for' ? 'against' : 'for';
      return (
        `Debate in ${l.targetLanguage} on the topic: "${ctx.topic ?? 'Should homework be banned?'}". ` +
        `The learner argues ${user}; you argue ${ai}. ${teacher(l)} ` +
        `Be respectful, give one clear argument per turn in 2-3 sentences, then challenge the learner. ` +
        `If the learner makes a language mistake, add a short "(Tip: ...)" at the end.`
      );
    }
  }
}

const JSON_ONLY = 'Return ONLY valid JSON. No markdown, no code fences, no commentary.';

export function generateSystem(type: GenerateType, topic: string, count: number, l: Learner): string {
  const intro = `You create ${l.targetLanguage} study material. ${teacher(l)} Topic: "${topic}". Translations are in ${l.nativeLanguage}. ${JSON_ONLY} `;
  switch (type) {
    case 'sentence':
      return intro + `Give ${count} useful sentences. Schema: {"items":[{"sentence":"","translation":"","note":"one short grammar or usage tip"}]}`;
    case 'word':
      return intro + `Give ${count} useful words. Schema: {"items":[{"word":"","translation":"","example":"","exampleTranslation":""}]}`;
    case 'dialogue':
      return intro + `Write a natural dialogue of ${Math.max(count, 6)} lines between speakers A and B. Schema: {"title":"","lines":[{"speaker":"A","text":"","translation":""}]}`;
    case 'flashcards':
      return intro + `Give ${count} flashcards. front is a ${l.targetLanguage} word or phrase, back is the translation. Schema: {"items":[{"front":"","back":"","hint":"short memory hint"}]}`;
  }
}

export const photoSystem = (l: Learner, hasDescription: boolean) =>
  `You are a ${l.targetLanguage} teacher. ${teacher(l)} ` +
  (hasDescription
    ? `The learner describes the attached image in ${l.targetLanguage}. Reply in this format: ` +
      `"Accuracy": whether it matches the image; "Corrections": fixed sentences with brief ${l.nativeLanguage} explanations; ` +
      `"Better version": one improved description in ${l.targetLanguage}; "New words": 3 useful words from the image.`
    : `The learner has not described the image yet. Give a short sample description in ${l.targetLanguage} ` +
      `with ${l.nativeLanguage} translation, plus 5 useful words from the image.`);

export const feedbackSystem = (l: Learner) =>
  `You review a ${l.targetLanguage} learner's practice from today. ${teacher(l)} ` +
  `Reply in ${l.nativeLanguage} with: Strengths (1-2 points), Mistakes to fix (up to 3, each with the corrected ${l.targetLanguage} sentence), ` +
  `and One thing to practice tomorrow. Be encouraging and under 150 words. Plain text, no markdown tables.`;
