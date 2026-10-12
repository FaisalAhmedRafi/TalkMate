export type ModeId =
  | "chat" | "call" | "sentence" | "word" | "dialogue"
  | "roleplay" | "characters" | "debate" | "photo" | "flashcards";

export type Mode = { id: ModeId; title: string; desc: string; emoji: string; premium: boolean };

export const MODES: Mode[] = [
  { id: "chat", title: "Chat", desc: "Enhance your language skills by chatting with our AI teacher.", emoji: "💬", premium: false },
  { id: "call", title: "Call Mode", desc: "Audio-only conversation to boost your speaking proficiency.", emoji: "🎧", premium: true },
  { id: "sentence", title: "Sentence Mode", desc: "Build a solid foundation of your language skills by learning basics.", emoji: "🗣️", premium: true },
  { id: "word", title: "Word Mode", desc: "Learn basic vocabulary with the word decks.", emoji: "🃏", premium: true },
  { id: "dialogue", title: "Dialogue Mode", desc: "Practice essential daily vocabulary with pre-scripted conversations.", emoji: "💭", premium: true },
  { id: "roleplay", title: "Roleplays", desc: "Practice through useful real-life scenarios.", emoji: "🎭", premium: true },
  { id: "characters", title: "Characters", desc: "Engage in dynamic conversations with famous characters.", emoji: "👑", premium: true },
  { id: "debate", title: "Debates", desc: "Argue for or against interesting and intriguing topics.", emoji: "🎤", premium: true },
  { id: "photo", title: "Photo Mode", desc: "Describe images and get real-time feedback.", emoji: "🖼️", premium: true },
  { id: "flashcards", title: "Flashcards", desc: "Practice and memorize new vocabulary.", emoji: "🌳", premium: true },
];

export const LANGUAGES = ["Spanish", "French", "German", "Italian", "Chinese", "Japanese", "Korean", "Hindi", "Bengali", "English", "Russian", "Arabic"];
export const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export const SPEECH_LANG: Record<string, string> = {
  Spanish: "es-ES", French: "fr-FR", German: "de-DE", Italian: "it-IT", Chinese: "zh-CN",
  Japanese: "ja-JP", Korean: "ko-KR", Hindi: "hi-IN", Bengali: "bn-BD", English: "en-US", Russian: "ru-RU", Arabic: "ar-SA"
};
