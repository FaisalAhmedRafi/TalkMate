// Deterministic pronunciation matching. The browser's speech recogniser tells us what it
// heard; this file compares that with the target sentence. The AI score is kept within
// one point of this result, so a flaky free model cannot invent a wildly wrong rating.

export type WordResult = { text: string; ok: boolean };
export type Match = { words: WordResult[]; spaced: boolean; similarity: number; missed: string[] };

// Chinese and Japanese are written without spaces, so they are compared character by character.
const NO_SPACE_LANGUAGES = new Set(['Chinese', 'Japanese']);

// Accents are dropped on Latin letters only ("ça" = "ca"), because recognisers differ on them and it is
// not a pronunciation error. Marks on Bengali, Hindi, Arabic etc. are real vowels and are kept.
const clean = (t: string) =>
  t.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC')
    .toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

function lcsFlags(a: string[], b: string[]): boolean[] {
  // flags[i] is true when a[i] is part of one longest common subsequence with b
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const flags = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { flags[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return flags;
}

export function matchSpeech(targetLanguage: string, sentence: string, heard: string): Match {
  const spaced = !NO_SPACE_LANGUAGES.has(targetLanguage);
  const display = spaced ? sentence.trim().split(/\s+/).filter(Boolean) : Array.from(sentence.trim());
  const heardTokens = (spaced ? heard.trim().split(/\s+/) : Array.from(heard)).map(clean).filter(Boolean);

  // Only tokens that contain letters or digits are scored; bare punctuation is always "ok".
  const scored: { index: number; token: string }[] = [];
  display.forEach((d, index) => { const token = clean(d); if (token) scored.push({ index, token }); });

  const flags = lcsFlags(scored.map((x) => x.token), heardTokens);
  const ok = new Array(display.length).fill(true);
  scored.forEach((x, k) => { ok[x.index] = flags[k]; });

  const matched = flags.filter(Boolean).length;
  const denom = scored.length + heardTokens.length;
  const similarity = denom === 0 ? 0 : (2 * matched) / denom; // Dice score on the longest common subsequence

  return {
    words: display.map((text, i) => ({ text, ok: ok[i] })),
    spaced,
    similarity,
    missed: display.filter((_, i) => !ok[i]).map((t) => t.replace(/[^\p{L}\p{M}\p{N}'-]/gu, '')).filter(Boolean),
  };
}

/** Map match quality (and the recogniser's own confidence, if the browser gave one) to 1-5. */
export function anchorScore(similarity: number, confidence?: number): number {
  const q = typeof confidence === 'number' ? 0.85 * similarity + 0.15 * confidence : similarity;
  if (q >= 0.95) return 5;
  if (q >= 0.8) return 4;
  if (q >= 0.6) return 3;
  if (q >= 0.35) return 2;
  return 1;
}

export const clampScore = (n: number, anchor: number) =>
  Math.min(5, Math.max(1, Math.min(anchor + 1, Math.max(anchor - 1, Math.round(n)))));
