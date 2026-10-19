const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "talkmate-token";

export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export type Msg = { role: "user" | "assistant"; content: string };
export type ChatMode = "chat" | "call" | "roleplay" | "characters" | "debate";
export type GenerateType = "sentence" | "word" | "dialogue" | "flashcards";
export type Learner = { targetLanguage: string; level: string; nativeLanguage?: string };
export type Achievement = { id: string; name: string; description: string; unlocked: boolean };
export type Stats = {
  totalSeconds: number; studiedDays: number; activeDays: number;
  days: { day: string; seconds: number }[]; achievements: Achievement[];
};
export type SentenceSkill = {
  id: string; title: string; description: string; emoji: string; passed: boolean; bestScore: number; attempts: number;
};
export type SentenceUnit = { number: number; title: string; skills: SentenceSkill[] };
export type SentenceUnits = { percent: number; passed: number; total: number; units: SentenceUnit[] };
export type SentenceItem = { sentence: string; translation: string; note: string };
export type WordStar = { id: string; emoji: string; passed: boolean; bestScore: number; inProgress: boolean };
export type WordUnit = { number: number; title: string; words: WordStar[] };
export type WordUnits = { language: string; percent: number; passed: number; total: number; units: WordUnit[] };
export type SentenceChunk = { text: string; meaning: string; explanation: string };
export type WordSentence = { sentence: string; translation: string; note: string; chunks: SentenceChunk[] };
export type WordLesson = {
  wordId: string; emoji: string; word: string; translation: string; sentences: WordSentence[];
  step: number; scores: (number | null)[]; resumed: boolean;
  image: { url: string; credit: string; creditUrl: string } | null;
};
export type PronunciationResult = {
  score: number; feedback: string; tip: string; heard: string; similarity: number;
  spaced: boolean; words: { text: string; ok: boolean }[]; source: "ai" | "fallback";
};
export type PersonalizationData = {
  values: Record<string, string | null>;
  questions: { key: string; label: string; options: string[] }[];
};
export type Referral = { code: string; invited: number; rewarded: number };
export type SubscriptionInfo = {
  status: "none" | "active" | "paused" | "canceled"; months: number | null;
  nextPayment: string | null; accessUntil: string | null; premium: boolean;
};
export type Progress = {
  email: string; xp: number; streak: number; longest: number; messages: number;
  premium: boolean; giftClaimed: boolean; language: string; nativeLanguage: string; level: string; today: string[];
};

async function request<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running on " + BASE + "?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken();
      window.location.href = "/login";
    }
    const m = (data as any).message;
    throw new Error(Array.isArray(m) ? m.join(", ") : m || `Request failed (${res.status})`);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown, keepalive = false) => request<T>("POST", path, body, keepalive);

export const api = {
  auth: {
    login: (b: { email: string; password: string }) => post<{ token: string }>("/auth/login", b),
    register: (b: { email: string; password: string; name?: string; referralCode?: string }) => post<{ token: string }>("/auth/register", b),
  },
  progress: {
    get: () => request<Progress>("GET", "/progress"),
    practice: (text: string) => post<Progress>("/progress/practice", { text }),
    settings: (b: { language?: string; nativeLanguage?: string; level?: string }) => request<Progress>("PATCH", "/progress/settings", b),
    premium: () => post<Progress>("/progress/premium"),
    gift: () => post<Progress>("/progress/gift"),
    stats: () => request<Stats>("GET", "/progress/stats"),
    time: (seconds: number, day: string, keepalive = false) => post<Progress>("/progress/time", { seconds, day }, keepalive),
  },
  account: {
    personalization: () => request<PersonalizationData>("GET", "/account/personalization"),
    savePersonalization: (b: Record<string, string>) => request<PersonalizationData>("PATCH", "/account/personalization", b),
    referral: () => request<Referral>("GET", "/account/referral"),
    subscription: () => request<SubscriptionInfo>("GET", "/account/subscription"),
    changePlan: (months: number) => post<SubscriptionInfo>("/account/subscription/plan", { months }),
    pause: () => post<SubscriptionInfo>("/account/subscription/pause"),
    resume: () => post<SubscriptionInfo>("/account/subscription/resume"),
    cancel: () => post<SubscriptionInfo>("/account/subscription/cancel"),
  },
  sentence: {
    units: () => request<SentenceUnits>("GET", "/sentence/units"),
    session: (skillId: string, b: Learner) => {
      if (!skillId) throw new Error("Couldn't tell which skill to practise. Go back and pick one.");
      return post<{ skillId: string; title: string; items: SentenceItem[] }>("/sentence/session", { ...b, skillId });
    },
    evaluate: (b: Learner & { sentence: string; transcript: string; confidence?: number }) =>
      post<PronunciationResult>("/sentence/evaluate", b),
    complete: (b: { skillId: string; scores: number[] }) =>
      post<{ average: number; passed: boolean; percent: number; progress: Progress }>("/sentence/complete", b),
  },
  word: {
    units: () => request<WordUnits>("GET", "/word/units"),
    /** Opens a lesson: resumes an unfinished one, unless restart is true */
    start: (wordId: string, b: Learner & { restart?: boolean }) => {
      if (!wordId) throw new Error("Couldn't tell which word to practise. Go back and pick one.");
      return post<WordLesson>("/word/start", { ...b, wordId });
    },
    save: (b: { wordId: string; language: string; step: number; scores: (number | null)[] }) =>
      request<{ ok: boolean }>("PATCH", "/word/lesson", b),
    complete: (b: { wordId: string; language: string; scores: (number | null)[] }) =>
      post<{ average: number; passed: boolean; percent: number; progress: Progress }>("/word/complete", b),
  },
  chat: (b: Learner & { mode: ChatMode; messages: Msg[]; context?: Record<string, string> }) =>
    post<{ reply: string }>("/ai/chat", b),
  generate: (b: Learner & { type: GenerateType; topic: string; count?: number }) => post<any>("/ai/generate", b),
  photo: (b: Learner & { image: string; description?: string }) => post<{ feedback: string }>("/ai/photo", b),
  feedback: (b: Learner & { texts: string[] }) => post<{ feedback: string }>("/ai/feedback", b),
};
