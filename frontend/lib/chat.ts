// Chat mode: the AI tutors and the chat settings that live in the browser.

export type Tutor = { id: string; img: string };

// Premium tutors are skipped for now: every tutor can be picked.
export const TUTORS: Tutor[] = [
  { id: "Emma", img: "/tutors/emma.png" },
  { id: "Kai", img: "/tutors/kai.png" },
  { id: "Nina", img: "/tutors/nina.png" },
  { id: "Niko", img: "/tutors/niko.png" },
];
export const tutorImg = (id: string) => (TUTORS.find((t) => t.id === id) ?? TUTORS[0]).img;

/** The Voice speed slider: 7 steps, "1x" is the fifth one. */
export const SPEEDS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2];

export type ChatPrefs = {
  tutor: string; // the tutor for new chats
  autoplay: boolean; // read the tutor's messages aloud (speaker button in the chat header)
  suggestions: boolean; // "Suggestion bar"
  autoMic: boolean; // "Auto microphone activation"
  speed: number; // index into SPEEDS
};

const KEY = "talkmate-chat-prefs";
export const DEFAULT_PREFS: ChatPrefs = { tutor: "Emma", autoplay: false, suggestions: true, autoMic: false, speed: 4 };

export function loadChatPrefs(): ChatPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const p = { ...DEFAULT_PREFS, ...raw };
    if (!TUTORS.some((t) => t.id === p.tutor)) p.tutor = DEFAULT_PREFS.tutor;
    if (!Number.isInteger(p.speed) || p.speed < 0 || p.speed >= SPEEDS.length) p.speed = DEFAULT_PREFS.speed;
    return p;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveChatPrefs(p: ChatPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: the settings just are not kept */ }
}
