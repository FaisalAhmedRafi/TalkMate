// Admin panel: API calls, types and the form definition of every mode.
import { getToken } from "./api";
import { COURSES } from "./courses";

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
  /** One added element, shaped for the form (lists as one line per entry). */
  get: (mode: AdminMode, id: string) => call<{ mode: AdminMode; id: string; item: Record<string, any> }>("GET", `/admin/items/${mode}/${encodeURIComponent(id)}`),
  update: (mode: AdminMode, id: string, item: unknown) =>
    call<{ ok: true; id: string; total: number; custom: number; units: Unit[] | null }>("PATCH", `/admin/items/${mode}/${encodeURIComponent(id)}`, { item }),
  remove: (mode: AdminMode, id: string) =>
    call<{ ok: true; total: number; custom: number; units: Unit[] | null }>("DELETE", `/admin/items/${mode}/${encodeURIComponent(id)}`),
};

// ---------- form definitions ----------
export type Field = {
  key: string; label: string; placeholder?: string; hint?: string; optional?: boolean;
  kind: "text" | "textarea" | "emoji" | "unit" | "select" | "hue" | "tasks" | "image" | "portrait";
  options?: "categories" | "kinds" | "courses";
  /** textarea only: taller box */
  tall?: boolean;
};

/** Courses an element can be added to (their Learn path then ends with it). */
export const COURSE_OPTIONS = COURSES.map((c) => ({ id: c.id, title: c.title }));
const COURSE: Field = {
  key: "course", label: "Add to a course", kind: "select", options: "courses", optional: true,
  hint: "Optional. Shows the element at the end of that course's Learn path (the first added word, sentence and dialogue of a course make one unit).",
};
const OWN = (key: string, label: string, placeholder: string, hint: string): Field =>
  ({ key, label, kind: "textarea", optional: true, tall: true, placeholder, hint });

const EMOJI: Field = { key: "emoji", label: "Emoji", kind: "emoji", placeholder: "🙂" };
const PHOTO: Field = { key: "photo", label: "Cover photo search", kind: "text", placeholder: "e.g. coffee shop counter", hint: "Words used to find the stock photo. A scene works better than people." };

export const FORMS: Record<AdminMode, Field[]> = {
  sentence: [
    { key: "unit", label: "Unit", kind: "unit" },
    { key: "title", label: "Skill title", kind: "text", placeholder: "Talking about hobbies" },
    EMOJI,
    { key: "description", label: "Description", kind: "textarea", placeholder: "One line shown under the title." },
    { ...PHOTO, label: "Photo search (Explore)", optional: true, hint: "Optional. Used for the picture on Explore." },
    OWN("sentences", "Your own sentences", "I am very sorry.\nPlease forgive me.\nIt was my mistake.", "Optional. 3 to 5 English sentences, one per line. The AI then only translates them into each learner's language instead of inventing its own."),
    COURSE,
  ],
  word: [
    { key: "unit", label: "Unit", kind: "unit" },
    { key: "english", label: "English word", kind: "text", placeholder: "to paint", hint: 'Verbs start with "to". The AI translates it into the learner\'s language.' },
    EMOJI,
    { ...PHOTO, label: "Photo search", optional: true, hint: "Optional. Defaults to the English word." },
    OWN("examples", "Your own example sentences", "I paint the wall every spring.", "Optional. Up to 3 English sentences using the word, one per line. The AI translates them and writes the rest."),
    COURSE,
  ],
  flashcards: [
    { key: "title", label: "Topic title", kind: "text", placeholder: "Tools" },
    EMOJI,
    PHOTO,
    { key: "hint", label: "What the 15 cards cover", kind: "textarea", placeholder: "tools: hammer, saw, screwdriver, drill, ladder ...", hint: "Guides the AI when it writes the deck." },
    OWN("words", "Your own word list", "hammer\nsaw\nscrewdriver\ndrill\nladder", "Optional. 5 to 15 English words, one per line. The deck is then exactly these words, translated by the AI, instead of 15 it picks. Decks a learner already opened keep their words until restarted."),
  ],
  dialogue: [
    { key: "title", label: "Topic title", kind: "text", placeholder: "At the dentist" },
    EMOJI,
    PHOTO,
    { key: "partner", label: "Who the learner talks to", kind: "text", placeholder: "Receptionist" },
    { key: "partnerEmoji", label: "Partner emoji", kind: "emoji", placeholder: "🧑‍💼" },
    { key: "setting", label: "Setting", kind: "textarea", placeholder: "booking a dentist appointment: day, time, reason for the visit" },
    OWN("script", "Your own conversation", "Partner: Hello, how can I help you?\nYou: I would like to book an appointment.\nPartner: Which day suits you?\nYou: Monday, please.\nPartner: See you then.\nYou: Thank you, goodbye.", "Optional. 3 to 5 turns in English: a Partner: line, then a You: line. The AI translates it instead of writing its own conversation."),
    COURSE,
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
    { key: "image", label: "Portrait", kind: "portrait", optional: true, hint: "Optional. A picture for the character; without one the emoji tile is used." },
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
  sentence: [{ unit: 2, title: "Saying sorry", emoji: "🙇", description: "Apologise politely in everyday situations.", photo: "apology note", sentences: ["I am very sorry.", "Please forgive me.", "It was my mistake."], course: "social-life" }],
  word: [{ unit: 3, english: "curtain", emoji: "🪟", photo: "window curtain", examples: ["The curtain is blue."], course: "absolute-beginner-1" }],
  flashcards: [{ title: "Tools", emoji: "🔧", photo: "tools on workbench", hint: "tools: hammer, saw, screwdriver, drill, ladder", words: ["hammer", "saw", "screwdriver", "drill", "ladder"] }],
  dialogue: [{ title: "At the dentist", emoji: "🦷", photo: "dentist chair", partner: "Receptionist", partnerEmoji: "🧑‍💼", setting: "booking a dentist appointment: day, time, reason for the visit", script: "Partner: Hello, how can I help you?\nYou: I would like to book an appointment.\nPartner: Which day suits you?\nYou: Monday, please.\nPartner: See you then.\nYou: Thank you, goodbye.", course: "travel" }],
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
