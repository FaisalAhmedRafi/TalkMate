const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "talkmate-token";

// "Remember this device" keeps the token in localStorage; otherwise it lives only until the browser session ends
export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY));
export const setToken = (t: string, remember = true) => {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
};
export const clearToken = () => { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); };

export type Msg = { role: "user" | "assistant"; content: string };
export type ChatMode = "chat" | "call" | "roleplay" | "debate";
export type GenerateType = "sentence" | "word" | "dialogue" | "flashcards";
export type Learner = { targetLanguage: string; level: string; nativeLanguage?: string };
export type Achievement = { id: string; name: string; description: string; unlocked: boolean };
export type Stats = {
  totalSeconds: number; studiedDays: number; activeDays: number;
  days: { day: string; seconds: number }[]; achievements: Achievement[];
};
export type SentenceSkill = {
  id: string; title: string; description: string; emoji: string; cover?: string | null; passed: boolean; bestScore: number; attempts: number;
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
  image: FlashImage | null;
};
export type PhotoItem = { id: string; image: string; passed: boolean; bestScore: number };
export type PhotoUnits = { language: string; percent: number; passed: number; total: number; units: { number: number; photos: PhotoItem[] }[] };
export type PhotoJudgement = {
  score: number;
  summary: string;
  corrections: { original: string; corrected: string; explanation: string }[];
  better: string;
  betterTranslation: string;
  words: { word: string; translation: string }[];
};
export type FlashImage = { url: string; credit: string; creditUrl: string; source?: string; sourceUrl?: string };
export type FlashTopicInfo = { id: string; title: string; emoji: string; total: number; known: number; completed: boolean; cover: string | null };
export type FlashTopics = { language: string; reviewCount: number; topics: FlashTopicInfo[] };
export type DialogueTopicInfo = { id: string; title: string; emoji: string; partner: string; partnerEmoji: string; cover: string | null; passed: boolean; bestScore: number; attempts: number };
export type DialogueTopics = { percent: number; passed: number; total: number; topics: DialogueTopicInfo[] };
export type DialogueTurn = { partner: string; partnerTranslation: string; you: string; youTranslation: string };
export type DialogueSession = { topicId: string; title: string; partner: { role: string; emoji: string }; turns: DialogueTurn[] };
export type DebateSide = "for" | "against";
export type DebateTopicInfo = {
  id: string; title: string; statement: string; emoji: string; cover: string | null;
  debated: boolean; saved: { for: number; against: number }; // saved = learner messages in the unfinished debate on each side
};
export type DebateTopics = { total: number; debated: number; topics: DebateTopicInfo[] };
export type DebateStart = {
  topicId: string; title: string; statement: string; side: DebateSide; teacher: { name: string; emoji: string }; opening: string;
};
/** One learner message checked by the AI: corrected is empty when the message was fine */
export type DebateFeedback = { correct: boolean; corrected: string; explanation: string; translation: string };
/** A saved debate: the conversation plus the reviews and translations keyed by message index */
export type DebateSaved = {
  intro: DebateStart; messages: Msg[]; reviews: Record<string, DebateFeedback>; translations: Record<string, string>;
};
export type CharacterKind = "history" | "myth" | "fiction";
export type CharacterInfo = {
  id: string; name: string; emoji: string; hue: number; kind: CharacterKind; about: string; cover?: string | null;
  saved: number; // learner messages in the saved conversation (0 = none)
};
export type CharacterList = { total: number; talked: number; characters: CharacterInfo[] };
export type CharacterStart = { characterId: string; name: string; emoji: string; hue: number; about: string; opening: string };
/** One spoken learner message checked by the AI: corrected is empty when the message was fine */
export type CallFeedback = { correct: boolean; corrected: string; explanation: string };
/** "Advanced feedback": a review of the whole call */
export type CallAdvanced = {
  summary: string; strengths: string[]; tips: string[];
  mistakes: { original: string; corrected: string; explanation: string }[];
};
/** A saved Call-mode call: the messages plus the reviews and translations keyed by message index */
export type CallSaved = {
  id: string; tutor: string; messages: Msg[]; reviews: Record<string, CallFeedback>; translations: Record<string, string>; seconds: number;
};
export type CallHistoryItem = { id: string; tutor: string; title: string; count: number; seconds: number; updatedAt: string };
/** One learner message checked by the AI: corrected is empty when the message was fine */
export type CharacterFeedback = { correct: boolean; corrected: string; explanation: string; translation: string };
/** A saved conversation: the messages plus the reviews and translations keyed by message index */
export type CharacterSaved = {
  intro: CharacterStart; messages: Msg[]; reviews: Record<string, CharacterFeedback>; translations: Record<string, string>;
};
export type RoleplayCategory = "Social" | "Transport" | "Travel" | "Food" | "Shopping";
export type RoleplayPartner = { name: string; emoji: string };
export type RoleplayScenarioInfo = {
  id: string; title: string; category: RoleplayCategory; emoji: string; cover: string | null;
  scenario: string; tasks: string[]; partner: RoleplayPartner;
  practiced: boolean; saved: number; // saved = learner messages in the unfinished chat
};
export type RoleplayScenarios = { total: number; practiced: number; scenarios: RoleplayScenarioInfo[] };
export type RoleplayStart = { scenarioId: string; title: string; scenario: string; tasks: string[]; partner: RoleplayPartner; opening: string };
/** One learner message checked by the AI: corrected is empty when the message was fine */
export type RoleplayFeedback = { correct: boolean; corrected: string; explanation: string; translation: string };
/** A saved chat: the conversation plus the reviews and translations keyed by message index */
export type RoleplaySaved = {
  intro: RoleplayStart; messages: Msg[]; reviews: Record<string, RoleplayFeedback>; translations: Record<string, string>;
};
/** A saved Chat-mode conversation: the messages plus the reviews and translations keyed by message index */
export type ChatSaved = {
  id: string; tutor: string; messages: Msg[]; reviews: Record<string, RoleplayFeedback>; translations: Record<string, string>;
};
export type ChatHistoryItem = { id: string; tutor: string; title: string; count: number; updatedAt: string };
export type FlashStatus = "new" | "learning" | "known";
export type FlashCard = {
  topicId: string; index: number; term: string; translation: string; example: string; exampleTranslation: string;
  image: FlashImage | null; status: FlashStatus; flagged: boolean;
};
export type FlashDeck = { topicId: string; title: string; emoji: string; cards: FlashCard[] };
export type PronunciationResult = {
  score: number; feedback: string; tip: string; heard: string; similarity: number;
  spaced: boolean; words: { text: string; ok: boolean }[]; source: "ai" | "fallback";
};
export type PersonalizationData = {
  values: Record<string, string | null>;
  questions: { key: string; label: string; options: string[] }[];
};
export type NotificationPrefs = { emailSpecialOffers: boolean; emailLearning: boolean; appSpecialOffers: boolean; appLearning: boolean };
export type PrivacyPrefs = { optOutAiTraining: boolean; optOutProfiling: boolean };
export type ProfileData = {
  email: string; firstName: string; lastName: string; timeZone: string; avatar: string | null;
  notifications: NotificationPrefs; privacy: PrivacyPrefs;
};
export type Referral = { code: string; invited: number; rewarded: number };
export type SubscriptionInfo = {
  status: "none" | "active" | "paused" | "canceled"; months: number | null;
  nextPayment: string | null; accessUntil: string | null; premium: boolean;
};
export type Progress = {
  email: string; name: string | null; xp: number; streak: number; longest: number; messages: number;
  premium: boolean; language: string; nativeLanguage: string; level: string; today: string[];
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
    // the backend's machine-readable `code` (e.g. EMAIL_NOT_VERIFIED) rides along on the error
    throw Object.assign(new Error(Array.isArray(m) ? m.join(", ") : m || `Request failed (${res.status})`), { code: (data as any).code as string | undefined });
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown, keepalive = false) => request<T>("POST", path, body, keepalive);

export const api = {
  auth: {
    login: (b: { email: string; password: string; remember?: boolean }) => post<{ token: string }>("/auth/login", b),
    register: (b: { email: string; password: string; firstName: string; lastName: string; referralCode?: string; remember?: boolean }) => post<{ verify: true; email: string }>("/auth/register", b),
    verifyEmail: (b: { email: string; code: string; remember?: boolean }) => post<{ token: string }>("/auth/verify-email", b),
    resendVerification: (email: string) => post<{ ok: true }>("/auth/resend-verification", { email }),
    google: (b: { credential: string; referralCode?: string; remember?: boolean }) => post<{ token: string }>("/auth/google", b),
    forgotPassword: (email: string) => post<{ ok: true }>("/auth/forgot-password", { email }),
    resetPassword: (b: { token: string; password: string }) => post<{ ok: true }>("/auth/reset-password", b),
  },
  progress: {
    get: () => request<Progress>("GET", "/progress"),
    practice: (text: string) => post<Progress>("/progress/practice", { text }),
    settings: (b: { language?: string; nativeLanguage?: string; level?: string }) => request<Progress>("PATCH", "/progress/settings", b),
    premium: () => post<Progress>("/progress/premium"),
    stats: () => request<Stats>("GET", "/progress/stats"),
    time: (seconds: number, day: string, keepalive = false) => post<Progress>("/progress/time", { seconds, day }, keepalive),
  },
  account: {
    personalization: () => request<PersonalizationData>("GET", "/account/personalization"),
    savePersonalization: (b: Record<string, string>) => request<PersonalizationData>("PATCH", "/account/personalization", b),
    profile: () => request<ProfileData>("GET", "/account/profile"),
    saveProfile: (b: { firstName?: string; lastName?: string; timeZone?: string }) => request<ProfileData>("PATCH", "/account/profile", b),
    saveAvatar: (image: string) => request<ProfileData>("PATCH", "/account/avatar", { image }),
    removeAvatar: () => request<ProfileData>("DELETE", "/account/avatar"),
    changePassword: (b: { currentPassword: string; newPassword: string }) => post<{ ok: true }>("/account/password", b),
    saveNotifications: (b: Partial<NotificationPrefs>) => request<ProfileData>("PATCH", "/account/notifications", b),
    savePrivacy: (b: Partial<PrivacyPrefs>) => request<ProfileData>("PATCH", "/account/privacy", b),
    sendSupport: (b: { type: string; message: string }) => post<{ ok: true }>("/account/support", b),
    deleteAccount: () => request<{ ok: true }>("DELETE", "/account"),
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
    covers: (ids: string[]) => request<{ covers: Record<string, string | null> }>("GET", `/word/covers?ids=${encodeURIComponent(ids.join(","))}`),
    /** One photo per Learn unit title (the same photo is used for all three exercises of the unit) */
    unitCovers: (titles: string[]) => request<{ covers: Record<string, string | null> }>("GET", `/word/unit-covers?titles=${encodeURIComponent(titles.join("|"))}`),
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
  photos: {
    units: () => request<PhotoUnits>("GET", "/photo/units"),
    judge: (b: Learner & { photoId: string; image: string; description: string }) =>
      post<{ result: PhotoJudgement; passed: boolean; bestScore: number; percent: number; progress: Progress }>("/photo/judge", b),
  },
  flashcards: {
    topics: () => request<FlashTopics>("GET", "/flashcards/topics"),
    /** Opens a deck: the saved 15 cards, or new ones when restart is true or it is the first time */
    deck: (topicId: string, b: Learner & { restart?: boolean }) => {
      if (!topicId) throw new Error("Couldn't tell which topic to open. Go back and pick one.");
      return post<FlashDeck>("/flashcards/deck", { ...b, topicId });
    },
    review: () => request<FlashDeck & { language: string }>("GET", "/flashcards/review"),
    mark: (b: { topicId: string; language: string; index: number; status?: "learning" | "known"; flagged?: boolean }) =>
      request<{ ok: boolean }>("PATCH", "/flashcards/mark", b),
    complete: (b: { topicId: string; known: number; total: number }) => post<{ progress: Progress }>("/flashcards/complete", b),
  },
  dialogue: {
    topics: () => request<DialogueTopics>("GET", "/dialogue/topics"),
    /** The scripted conversation for a topic; fresh asks for a new script instead of the saved one */
    session: (topicId: string, b: Learner & { fresh?: boolean }) => {
      if (!topicId) throw new Error("Couldn't tell which dialogue to practise. Go back and pick one.");
      return post<DialogueSession>("/dialogue/session", { ...b, topicId });
    },
    complete: (b: { topicId: string; scores: number[] }) =>
      post<{ average: number; passed: boolean; percent: number; progress: Progress }>("/dialogue/complete", b),
  },
  debate: {
    topics: () => request<DebateTopics>("GET", "/debate/topics"),
    /** Opens a debate: the teacher's first message for the topic and the learner's side */
    start: (topicId: string, side: DebateSide, b: Learner) => {
      if (!topicId) throw new Error("Couldn't tell which debate to open. Go back and pick one.");
      return post<DebateStart>("/debate/start", { ...b, topicId, side });
    },
    /** The teacher's answer; messages start with the opening and end with the learner's new message */
    reply: (b: Learner & { topicId: string; side: DebateSide; messages: Msg[] }) => post<{ reply: string }>("/debate/reply", b),
    feedback: (b: Learner & { message: string }) => post<DebateFeedback>("/debate/feedback", b),
    /** The saved debate for a topic and side, or null */
    session: (topicId: string, side: DebateSide) =>
      request<{ session: DebateSaved | null }>("GET", `/debate/session?topicId=${encodeURIComponent(topicId)}&side=${side}`),
    save: (b: { topicId: string; side: DebateSide; messages: Msg[]; reviews: Record<string, DebateFeedback>; translations: Record<string, string> }) =>
      request<{ ok: boolean }>("PUT", "/debate/session", b),
    clear: (topicId: string, side: DebateSide) =>
      request<{ ok: boolean }>("DELETE", `/debate/session?topicId=${encodeURIComponent(topicId)}&side=${side}`),
    translate: (b: Learner & { text: string }) => post<{ translation: string }>("/debate/translate", b),
  },
  call: {
    /** The tutor picks up: their first line */
    start: (b: Learner & { tutor: string }) => post<{ teacher: { name: string }; opening: string }>("/call/start", b),
    /** The tutor's answer; messages start with their greeting and end with the learner's new message */
    reply: (b: Learner & { tutor: string; messages: Msg[] }) => post<{ reply: string }>("/call/reply", b),
    feedback: (b: Learner & { message: string }) => post<CallFeedback>("/call/feedback", b),
    translate: (b: Learner & { text: string }) => post<{ translation: string }>("/call/translate", b),
    advanced: (b: Learner & { tutor: string; messages: Msg[] }) => post<CallAdvanced>("/call/advanced", b),
    /** The open call for the current target language, or null */
    session: () => request<{ session: CallSaved | null }>("GET", "/call/session"),
    save: (b: { tutor: string; messages: Msg[]; reviews: Record<string, CallFeedback>; translations: Record<string, string>; seconds: number }) =>
      request<{ ok: boolean }>("PUT", "/call/session", b),
    /** "Start a new call": the open call moves to the history */
    archive: () => post<{ ok: boolean }>("/call/archive"),
    history: () => request<{ calls: CallHistoryItem[] }>("GET", "/call/history"),
    /** Opens a call from the history (the open call moves to the history) */
    open: (id: string) => post<{ session: CallSaved }>(`/call/history/${encodeURIComponent(id)}/open`),
    remove: (id: string) => request<{ ok: boolean }>("DELETE", `/call/history/${encodeURIComponent(id)}`),
  },
  characters: {
    list: () => request<CharacterList>("GET", "/characters"),
    /** Opens a conversation: the character's first message */
    start: (characterId: string, b: Learner) => {
      if (!characterId) throw new Error("Couldn't tell which character to open. Go back and pick one.");
      return post<CharacterStart>("/characters/start", { ...b, characterId });
    },
    /** The character's answer; messages start with the opening and end with the learner's new message */
    reply: (b: Learner & { characterId: string; messages: Msg[] }) => post<{ reply: string }>("/characters/reply", b),
    feedback: (b: Learner & { message: string }) => post<CharacterFeedback>("/characters/feedback", b),
    /** The saved conversation with a character, or null */
    session: (characterId: string) =>
      request<{ session: CharacterSaved | null }>("GET", `/characters/session?characterId=${encodeURIComponent(characterId)}`),
    save: (b: { characterId: string; messages: Msg[]; reviews: Record<string, CharacterFeedback>; translations: Record<string, string> }) =>
      request<{ ok: boolean }>("PUT", "/characters/session", b),
    clear: (characterId: string) =>
      request<{ ok: boolean }>("DELETE", `/characters/session?characterId=${encodeURIComponent(characterId)}`),
    translate: (b: Learner & { text: string }) => post<{ translation: string }>("/characters/translate", b),
  },
  roleplay: {
    scenarios: () => request<RoleplayScenarios>("GET", "/roleplay/scenarios"),
    /** Opens a scenario: the partner's first line */
    start: (scenarioId: string, b: Learner) => {
      if (!scenarioId) throw new Error("Couldn't tell which roleplay to open. Go back and pick one.");
      return post<RoleplayStart>("/roleplay/start", { ...b, scenarioId });
    },
    /** The partner's answer; messages start with the opening line and end with the learner's new message */
    reply: (b: Learner & { scenarioId: string; messages: Msg[] }) => post<{ reply: string }>("/roleplay/reply", b),
    feedback: (b: Learner & { message: string }) => post<RoleplayFeedback>("/roleplay/feedback", b),
    /** The saved chat for a scenario, or null */
    session: (scenarioId: string) =>
      request<{ session: RoleplaySaved | null }>("GET", `/roleplay/session?scenarioId=${encodeURIComponent(scenarioId)}`),
    save: (b: { scenarioId: string; messages: Msg[]; reviews: Record<string, RoleplayFeedback>; translations: Record<string, string> }) =>
      request<{ ok: boolean }>("PUT", "/roleplay/session", b),
    clear: (scenarioId: string) =>
      request<{ ok: boolean }>("DELETE", `/roleplay/session?scenarioId=${encodeURIComponent(scenarioId)}`),
    translate: (b: Learner & { text: string }) => post<{ translation: string }>("/roleplay/translate", b),
  },
  chat: {
    /** The tutor's greeting for a new chat */
    start: (b: Learner & { tutor: string }) => post<{ opening: string }>("/chat/start", b),
    /** The tutor's answer; messages start with the greeting and end with the learner's new message */
    reply: (b: Learner & { tutor: string; messages: Msg[] }) => post<{ reply: string }>("/chat/reply", b),
    /** Three tappable replies for the suggestion bar; messages end with the tutor's message */
    suggestions: (b: Learner & { tutor: string; messages: Msg[] }) => post<{ suggestions: string[] }>("/chat/suggestions", b),
    feedback: (b: Learner & { message: string }) => post<RoleplayFeedback>("/chat/feedback", b),
    translate: (b: Learner & { text: string }) => post<{ translation: string }>("/chat/translate", b),
    /** The open chat for the current target language, or null */
    session: () => request<{ session: ChatSaved | null }>("GET", "/chat/session"),
    save: (b: { tutor: string; messages: Msg[]; reviews: Record<string, RoleplayFeedback>; translations: Record<string, string> }) =>
      request<{ ok: boolean }>("PUT", "/chat/session", b),
    /** "Start a new chat": the open chat moves to the history */
    archive: () => post<{ ok: boolean }>("/chat/archive"),
    history: () => request<{ chats: ChatHistoryItem[] }>("GET", "/chat/history"),
    /** Opens a chat from the history (the open chat moves to the history) */
    open: (id: string) => post<{ session: ChatSaved }>(`/chat/history/${encodeURIComponent(id)}/open`),
    remove: (id: string) => request<{ ok: boolean }>("DELETE", `/chat/history/${encodeURIComponent(id)}`),
  },
  generate: (b: Learner & { type: GenerateType; topic: string; count?: number }) => post<any>("/ai/generate", b),
  photo: (b: Learner & { image: string; description?: string }) => post<{ feedback: string }>("/ai/photo", b),
  feedback: (b: Learner & { texts: string[] }) => post<{ feedback: string }>("/ai/feedback", b),
};
