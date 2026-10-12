const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "talkpal-token";

export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export type Msg = { role: "user" | "assistant"; content: string };
export type ChatMode = "chat" | "call" | "roleplay" | "characters" | "debate";
export type GenerateType = "sentence" | "word" | "dialogue" | "flashcards";
export type Learner = { targetLanguage: string; level: string };
export type Progress = {
  email: string; xp: number; streak: number; longest: number; messages: number;
  premium: boolean; giftClaimed: boolean; language: string; level: string; today: string[];
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
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

const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body);

export const api = {
  auth: {
    login: (b: { email: string; password: string }) => post<{ token: string }>("/auth/login", b),
    register: (b: { email: string; password: string; name?: string }) => post<{ token: string }>("/auth/register", b),
  },
  progress: {
    get: () => request<Progress>("GET", "/progress"),
    practice: (text: string) => post<Progress>("/progress/practice", { text }),
    settings: (b: { language?: string; level?: string }) => request<Progress>("PATCH", "/progress/settings", b),
    premium: () => post<Progress>("/progress/premium"),
    gift: () => post<Progress>("/progress/gift"),
  },
  chat: (b: Learner & { mode: ChatMode; messages: Msg[]; context?: Record<string, string> }) =>
    post<{ reply: string }>("/ai/chat", b),
  generate: (b: Learner & { type: GenerateType; topic: string; count?: number }) => post<any>("/ai/generate", b),
  photo: (b: Learner & { image: string; description?: string }) => post<{ feedback: string }>("/ai/photo", b),
  feedback: (b: Learner & { texts: string[] }) => post<{ feedback: string }>("/ai/feedback", b),
};
