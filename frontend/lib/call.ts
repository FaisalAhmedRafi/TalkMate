// Call mode: the settings that live in the browser. The tutors themselves are shared with Chat mode (lib/chat.ts).
import { SPEEDS, TUTORS } from "@/lib/chat";

export type CallPrefs = {
  tutor: string; // the tutor for new calls
  speed: number; // index into SPEEDS: how fast the tutor talks
};

const KEY = "talkmate-call-prefs";
// Call Mode has always been with Kai, so he stays the default.
export const DEFAULT_CALL_PREFS: CallPrefs = { tutor: "Kai", speed: 4 };

export function loadCallPrefs(): CallPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const p = { ...DEFAULT_CALL_PREFS, ...raw };
    if (!TUTORS.some((t) => t.id === p.tutor)) p.tutor = DEFAULT_CALL_PREFS.tutor;
    if (!Number.isInteger(p.speed) || p.speed < 0 || p.speed >= SPEEDS.length) p.speed = DEFAULT_CALL_PREFS.speed;
    return p;
  } catch {
    return DEFAULT_CALL_PREFS;
  }
}

export function saveCallPrefs(p: CallPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: the settings just are not kept */ }
}
