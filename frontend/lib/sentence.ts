import { useParams, usePathname } from "next/navigation";

// Small client-side helpers shared by the Sentence Mode pages.

/** The skill id from /sentence/<skillId>[/practice]. Reads the URL itself so it still works if the folder is not named exactly [skillId]. */
export function useSkillId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.skillId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

/** Where an in-progress practice session is kept, so a refresh doesn't generate new sentences. */
// the translation language is part of the key too, so changing "My language" never reuses old translations
export const sessionKey = (skillId: string, language: string, level: string, native: string) =>
  `talkmate-sentence:${skillId}:${language}:${level}:${native}`;

export type SentencePrefs = { autoplay: boolean; slow: boolean; showTranslation: boolean };
const PREFS_KEY = "talkmate-sentence-prefs";
const DEFAULT_PREFS: SentencePrefs = { autoplay: true, slow: false, showTranslation: true };

export function loadPrefs(): SentencePrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") }; }
  catch { return DEFAULT_PREFS; }
}
export const savePrefs = (p: SentencePrefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {} };

export const SCORE_LABEL = ["", "Keep trying", "Getting there", "Good", "Very good", "Excellent"];
export const PASS_SCORE = 3; // keep in sync with PASS_SCORE in backend/src/sentence/sentence.service.ts
