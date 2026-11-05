export type ModeId =
  | "chat" | "call" | "sentence" | "word" | "dialogue"
  | "roleplay" | "characters" | "debate" | "photo" | "flashcards";

export type Mode = { id: ModeId; title: string; desc: string; emoji: string; image: string; premium: boolean };

// Dashboard card pictures live in frontend/public/modes/<id>.png (your own images; if one is missing the emoji is shown).
// To use .jpg/.webp instead, just change the extension in the image paths below.
export const MODES: Mode[] = [
  { id: "chat", image: "/modes/chat.png", title: "Chat", desc: "Enhance your language skills by chatting with our AI teacher.", emoji: "💬", premium: false },
  { id: "call", image: "/modes/call.png", title: "Call Mode", desc: "Audio-only conversation to boost your speaking proficiency.", emoji: "🎧", premium: true },
  { id: "sentence", image: "/modes/sentence.png", title: "Sentence Mode", desc: "Build a solid foundation of your language skills by learning basics.", emoji: "🗣️", premium: true },
  { id: "word", image: "/modes/word.png", title: "Word Mode", desc: "Learn basic vocabulary with the word decks.", emoji: "🃏", premium: true },
  { id: "dialogue", image: "/modes/dialogue.png", title: "Dialogue Mode", desc: "Practice essential daily vocabulary with pre-scripted conversations.", emoji: "💭", premium: true },
  { id: "roleplay", image: "/modes/roleplay.png", title: "Roleplays", desc: "Practice through useful real-life scenarios.", emoji: "🎭", premium: true },
  { id: "characters", image: "/modes/characters.png", title: "Characters", desc: "Engage in dynamic conversations with famous characters.", emoji: "👑", premium: true },
  { id: "debate", image: "/modes/debate.png", title: "Debates", desc: "Argue for or against interesting and intriguing topics.", emoji: "🎤", premium: true },
  { id: "photo", image: "/modes/photo.png", title: "Photo Mode", desc: "Describe images and get real-time feedback.", emoji: "🖼️", premium: true },
  { id: "flashcards", image: "/modes/flashcards.png", title: "Flashcards", desc: "Practice and memorize new vocabulary.", emoji: "🌳", premium: true },
];

export const LANGUAGES = ["Spanish", "French", "German", "Italian", "Chinese", "Japanese", "Korean", "Hindi", "Bengali", "English", "Russian", "Arabic"];
export const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export const SPEECH_LANG: Record<string, string> = {
  Spanish: "es-ES", French: "fr-FR", German: "de-DE", Italian: "it-IT", Chinese: "zh-CN",
  Japanese: "ja-JP", Korean: "ko-KR", Hindi: "hi-IN", Bengali: "bn-BD", English: "en-US", Russian: "ru-RU", Arabic: "ar-SA"
};
