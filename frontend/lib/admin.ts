// Admin panel: API calls, types and the form definition of every mode.
import { getToken } from "./api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type AdminMode = "sentence" | "word" | "flashcards" | "dialogue" | "debate" | "characters" | "roleplay" | "photo";
export type Unit = { number: number; title: string };
export type ModeInfo = { mode: AdminMode; label: string; total: number; custom: number; units: Unit[] | null };
export type Overview = { modes: ModeInfo[]; roleplayCategories: string[]; characterKinds: string[] };
export type Row = { id: string; title: string; sub: string; emoji: string; group: string; custom: boolean; image?: string | null };
export type ImportResult = {
  created: number; failed: number; total: number; custom: number; units: Unit[] | null;
  results: { index: number; ok: boolean; id?: string; error?: string }[];
};

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    const m = (data as any).message;
    throw Object.assign(new Error(Array.isArray(m) ? m.join(", ") : m || `Request failed (${res.status})`), { status: res.status });
  }
  return data as T;
}

export const admin = {
  me: () => call<{ admin: boolean; configured: boolean }>("GET", "/admin/me"),
  overview: () => call<Overview>("GET", "/admin/overview"),
  items: (mode: AdminMode) => call<{ mode: AdminMode; rows: Row[] }>("GET", `/admin/items?mode=${mode}`),
  create: (mode: AdminMode, item: unknown) =>
    call<{ ok: true; id: string; total: number; custom: number; units: Unit[] | null }>("POST", "/admin/items", { mode, item }),
  import: (mode: AdminMode, items: unknown[]) => call<ImportResult>("POST", "/admin/import", { mode, items }),
  remove: (mode: AdminMode, id: string) =>
    call<{ ok: true; total: number; custom: number; units: Unit[] | null }>("DELETE", `/admin/items/${mode}/${encodeURIComponent(id)}`),
};

// ---------- form definitions ----------
export type Field = {
  key: string; label: string; placeholder?: string; hint?: string; optional?: boolean;
  kind: "text" | "textarea" | "emoji" | "unit" | "select" | "hue" | "tasks" | "image";
  options?: "categories" | "kinds";
};

const EMOJI: Field = { key: "emoji", label: "Emoji", kind: "emoji", placeholder: "🙂" };
const PHOTO: Field = { key: "photo", label: "Cover photo search", kind: "text", placeholder: "e.g. coffee shop counter", hint: "Words used to find the stock photo. A scene works better than people." };

export const FORMS: Record<AdminMode, Field[]> = {
  sentence: [
    { key: "unit", label: "Unit", kind: "unit" },
    { key: "title", label: "Skill title", kind: "text", placeholder: "Talking about hobbies" },
    EMOJI,
    { key: "description", label: "Description", kind: "textarea", placeholder: "One line shown under the title." },
    { ...PHOTO, label: "Photo search (Explore)", optional: true, hint: "Optional. Used for the picture on Explore." },
  ],
  word: [
    { key: "unit", label: "Unit", kind: "unit" },
    { key: "english", label: "English word", kind: "text", placeholder: "to paint", hint: 'Verbs start with "to". The AI translates it into the learner\'s language.' },
    EMOJI,
    { ...PHOTO, label: "Photo search", optional: true, hint: "Optional. Defaults to the English word." },
  ],
  flashcards: [
    { key: "title", label: "Topic title", kind: "text", placeholder: "Tools" },
    EMOJI,
    PHOTO,
    { key: "hint", label: "What the 15 cards cover", kind: "textarea", placeholder: "tools: hammer, saw, screwdriver, drill, ladder ...", hint: "Guides the AI when it writes the deck." },
  ],
  dialogue: [
    { key: "title", label: "Topic title", kind: "text", placeholder: "At the dentist" },
    EMOJI,
    PHOTO,
    { key: "partner", label: "Who the learner talks to", kind: "text", placeholder: "Receptionist" },
    { key: "partnerEmoji", label: "Partner emoji", kind: "emoji", placeholder: "🧑‍💼" },
    { key: "setting", label: "Setting", kind: "textarea", placeholder: "booking a dentist appointment: day, time, reason for the visit" },
  ],
  debate: [
    { key: "title", label: "Topic title", kind: "text", placeholder: "Electric cars" },
    EMOJI,
    { key: "statement", label: "Statement to argue", kind: "textarea", placeholder: "Electric cars are better for the planet than petrol cars." },
    PHOTO,
  ],
  characters: [
    { key: "name", label: "Name", kind: "text", placeholder: "Ada Lovelace" },
    EMOJI,
    { key: "kind", label: "Kind", kind: "select", options: "kinds" },
    { key: "hue", label: "Tile colour", kind: "hue", hint: "Colour of the tile when there is no portrait." },
    { key: "about", label: "About (persona)", kind: "textarea", placeholder: "Who they are, how they talk and what they like to talk about." },
  ],
  roleplay: [
    { key: "title", label: "Scenario title", kind: "text", placeholder: "Returning an item" },
    { key: "category", label: "Category", kind: "select", options: "categories" },
    EMOJI,
    PHOTO,
    { key: "partner", label: "Partner", kind: "text", placeholder: "Shop assistant" },
    { key: "partnerEmoji", label: "Partner emoji", kind: "emoji", placeholder: "🧑‍💼" },
    { key: "scenario", label: "Scenario", kind: "textarea", placeholder: "You bought a jacket that does not fit and want to bring it back." },
    { key: "tasks", label: "Three tasks", kind: "tasks" },
  ],
  photo: [
    { key: "unit", label: "Unit", kind: "unit" },
    { key: "image", label: "Pictures", kind: "image" },
  ],
};

/** Example payloads for the "Import JSON" box. */
export const TEMPLATES: Record<Exclude<AdminMode, "photo">, unknown[]> = {
  sentence: [{ unit: 2, title: "Saying sorry", emoji: "🙇", description: "Apologise politely in everyday situations.", photo: "apology note" }],
  word: [{ unit: 3, english: "curtain", emoji: "🪟", photo: "window curtain" }],
  flashcards: [{ title: "Tools", emoji: "🔧", photo: "tools on workbench", hint: "tools: hammer, saw, screwdriver, drill, ladder" }],
  dialogue: [{ title: "At the dentist", emoji: "🦷", photo: "dentist chair", partner: "Receptionist", partnerEmoji: "🧑‍💼", setting: "booking a dentist appointment: day, time, reason for the visit" }],
  debate: [{ title: "Electric cars", statement: "Electric cars are better for the planet than petrol cars.", emoji: "🔌", photo: "electric car charging" }],
  characters: [{ name: "Ada Lovelace", emoji: "🧮", hue: 280, kind: "history", about: "Ada Lovelace, the first computer programmer. Curious and imaginative, she loves mathematics, poetry and machines." }],
  roleplay: [{ title: "Returning an item", category: "Shopping", emoji: "🛍️", photo: "clothes shop counter", partner: "Shop assistant", partnerEmoji: "🧑‍💼", scenario: "You bought a jacket that does not fit and want to bring it back.", tasks: ["Say you want to return the jacket.", "Explain why it does not fit.", "Ask for a refund or an exchange."] }],
};

/** Shrinks a picture to a JPEG data URL (max `max` px on the long side) so the upload stays small. */
export function fileToDataUrl(file: File, max = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`"${file.name}" is not a picture the browser can read.`)); };
    img.src = url;
  });
}
