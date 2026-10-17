// The Personalization questions. The frontend renders whatever this list says, and the DTO checks against it.
export const QUESTIONS = [
  {
    key: 'reason', label: "What's the primary reason for learning?",
    options: ['Job and Career', 'Travel', 'Education', 'Family and Friends', 'Culture and Entertainment', 'Just for fun'],
  },
  {
    key: 'frequency', label: 'How often do you want to practice?',
    options: ['5 minutes a day', '15 minutes a day', '30 minutes a day', '1 hour a day', 'A few times a week'],
  },
  {
    key: 'goal', label: 'What are you looking to achieve?',
    options: ['I want to become fluent', 'I want to have everyday conversations', 'I want to prepare for travel', 'I want to pass an exam', 'I want to build my vocabulary'],
  },
  {
    key: 'style', label: "What's your learning style?",
    options: ['I like speaking', 'I like listening', 'I like reading', 'I like writing', 'I like a mix'],
  },
  {
    key: 'ageRange', label: 'How old are you?',
    options: ['Under 18', '18-24', '25-34', '35-44', '45-54', '55+'],
  },
];

export const optionsFor = (key: string) => QUESTIONS.find((q) => q.key === key)!.options;
