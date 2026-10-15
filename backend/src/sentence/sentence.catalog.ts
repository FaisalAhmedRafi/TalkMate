// The Sentence Mode curriculum: 10 units x 3 skills, matching the unit list in the UI.
// Skill ids are URL slugs (/sentence/<id>), so never rename one once users have progress on it.

export type SentenceSkill = { id: string; title: string; description: string; emoji: string };
export type SentenceUnit = { number: number; title: string; skills: SentenceSkill[] };

const s = (id: string, title: string, emoji: string, description: string): SentenceSkill => ({ id, title, emoji, description });

export const SENTENCE_UNITS: SentenceUnit[] = [
  {
    number: 1, title: 'Essential phrases',
    skills: [
      s('basic-greetings', 'Basic greetings', '👋', 'Build a solid foundation of your language skills by learning basics.'),
      s('talking-about-yourself', 'Talking about yourself', '🙋', 'Say your name, where you are from and what you do.'),
      s('introducing-others', 'Introducing others', '🤝', 'Introduce a friend, a colleague or a family member politely.'),
    ],
  },
  {
    number: 2, title: 'Social interactions',
    skills: [
      s('being-polite', 'Being polite', '🙏', 'Use please, thank you and other polite everyday expressions.'),
      s('formal-greetings-and-farewells', 'Formal greetings and farewells', '🎩', 'Greet and say goodbye in formal and professional situations.'),
      s('discussing-personal-backgrounds', 'Discussing personal backgrounds', '🌍', 'Talk about where you grew up, your studies and your work.'),
    ],
  },
  {
    number: 3, title: 'Basic communication',
    skills: [
      s('asking-for-basic-information', 'Asking for basic information', '❓', 'Ask simple questions about places, prices and directions.'),
      s('expressing-likes-and-dislikes', 'Expressing likes and dislikes', '👍', 'Say what you like, love, dislike or prefer.'),
      s('exchanging-contact-information', 'Exchanging contact information', '📱', 'Share and ask for phone numbers, emails and social media.'),
    ],
  },
  {
    number: 4, title: 'Languages and communication',
    skills: [
      s('talking-about-languages', 'Talking about languages', '🗣️', 'Say which languages you speak and which you are learning.'),
      s('asking-for-language-help', 'Asking for language help', '🆘', 'Ask someone to repeat, speak slowly or explain a word.'),
      s('discussing-language-progress', 'Discussing language progress', '📈', 'Describe how your language learning is going.'),
    ],
  },
  {
    number: 5, title: 'Handling difficulties',
    skills: [
      s('navigating-language-barriers', 'Navigating language barriers', '🚧', 'Get your message across when you do not know the right words.'),
      s('apologizing-and-making-amends', 'Apologizing and making amends', '😔', 'Apologize, explain a mistake and offer to make it right.'),
      s('finding-lost-items', 'Finding lost items', '🔍', 'Ask for help when you lose your phone, wallet or keys.'),
    ],
  },
  {
    number: 6, title: 'Describing people',
    skills: [
      s('describing-physical-appearance', 'Describing physical appearance', '🧑', 'Describe how someone looks: hair, height, clothes and age.'),
      s('discussing-personalities', 'Discussing personalities', '😊', 'Talk about what people are like: kind, shy, funny and more.'),
      s('asking-about-moods-and-feelings', 'Asking about moods and feelings', '💭', 'Ask how someone feels and talk about your own emotions.'),
    ],
  },
  {
    number: 7, title: 'Friendships',
    skills: [
      s('making-new-friends', 'Making new friends', '🧑‍🤝‍🧑', 'Start a conversation and connect with someone new.'),
      s('socializing-with-friends', 'Socializing with friends', '🎉', 'Chat, joke and share plans with friends.'),
      s('arranging-to-meet-up', 'Arranging to meet up', '📍', 'Suggest a time and place, and confirm plans.'),
    ],
  },
  {
    number: 8, title: 'Small talk',
    skills: [
      s('keeping-a-conversation-going', 'Keeping a conversation going', '💬', 'Ask follow-up questions and keep a chat flowing.'),
      s('active-listening-and-reacting', 'Active listening and reacting', '👂', 'React with interest, surprise and agreement.'),
      s('talking-about-the-weekend', 'Talking about the weekend', '🏖️', 'Share what you did or plan to do on the weekend.'),
    ],
  },
  {
    number: 9, title: 'Family life',
    skills: [
      s('talking-about-your-family', 'Talking about your family', '👨‍👩‍👧', 'Describe the people in your family and how you are related.'),
      s('family-activities', 'Family activities', '🍽️', 'Talk about meals, trips and traditions with your family.'),
      s('talking-about-pets', 'Talking about pets', '🐶', 'Describe your pets and what they like to do.'),
    ],
  },
  {
    number: 10, title: 'Time and scheduling',
    skills: [
      s('asking-and-telling-time', 'Asking and telling time', '🕒', 'Ask what time it is and say the time clearly.'),
      s('scheduling-appointments', 'Scheduling appointments', '📅', 'Book, change or cancel an appointment.'),
      s('talking-about-upcoming-events', 'Talking about upcoming events', '🎟️', 'Talk about events, deadlines and plans coming up.'),
    ],
  },
];

export const TOTAL_SKILLS = SENTENCE_UNITS.reduce((n, u) => n + u.skills.length, 0);

export function findSkill(id: string): { unit: SentenceUnit; skill: SentenceSkill } | null {
  for (const unit of SENTENCE_UNITS) {
    const skill = unit.skills.find((k) => k.id === id);
    if (skill) return { unit, skill };
  }
  return null;
}
