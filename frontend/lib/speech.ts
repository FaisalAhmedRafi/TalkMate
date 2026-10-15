// Browser speech helpers for Sentence Mode: read a sentence aloud, and listen to the learner.
// Speech recognition works in Chrome and Edge (Safari is partial, Firefox has none).

export const supportsSpeechRecognition = () =>
  typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export function createRecognition(lang: string): any | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang;
  r.interimResults = true; // lets us show what is being heard live
  r.continuous = false; // stops by itself after the learner pauses
  r.maxAlternatives = 1;
  return r;
}

const primary = (lang: string) => lang.slice(0, 2).toLowerCase();

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  return exact ?? voices.find((v) => primary(v.lang) === primary(lang));
}

/** False only when the browser has loaded its voices and none speak this language. */
export function hasVoiceFor(lang: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  return voices.length === 0 || voices.some((v) => primary(v.lang) === primary(lang));
}

export function speak(text: string, lang: string, rate: number, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onEnd?.();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
}

export const cancelSpeech = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
};
