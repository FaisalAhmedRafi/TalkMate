"use client";
import { Star } from "lucide-react";
import type { PronunciationResult } from "@/lib/api";
import { SCORE_LABEL } from "@/lib/sentence";

export const Stars = ({ n, size = 18 }: { n: number; size?: number }) => (
  <span className="inline-flex gap-0.5" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} className={i <= n ? "fill-yellow-400 text-yellow-400" : "text-white/25"} />
    ))}
  </span>
);

/** The sentence with each word coloured: green when it was heard, red when it was missed. */
export const ColoredSentence = ({ r }: { r: PronunciationResult }) => (
  <>
    {r.words.map((w, i) => (
      <span key={i} className={w.ok ? "text-emerald-300" : "text-red-300 underline decoration-red-400/60 underline-offset-4"}>
        {w.text}{r.spaced && i < r.words.length - 1 ? " " : ""}
      </span>
    ))}
  </>
);

/** Stars, feedback and tip for one spoken sentence, with Try again and Next/Finish. */
export function Review({ r, last, onRetry, onNext }: { r: PronunciationResult; last: boolean; onRetry: () => void; onNext: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-[#26262d] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Stars n={r.score} size={22} />
        <span className="text-lg font-semibold">{r.score}/5</span>
        <span className="text-sm text-white/60">{SCORE_LABEL[r.score]}</span>
      </div>
      {r.feedback && <p className="mt-3 text-sm">{r.feedback}</p>}
      {r.tip && <p className="mt-2 text-sm text-white/70"><span className="font-semibold text-white/90">Tip:</span> {r.tip}</p>}
      <p className="mt-3 text-xs text-white/50">We heard: “{r.heard}”</p>
      {r.source === "fallback" && (
        <p className="mt-1 text-xs text-white/40">AI feedback wasn&apos;t available, so this score is based on how closely your words matched.</p>
      )}
      <div className="mt-5 flex gap-3">
        <button onClick={onRetry} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Try again</button>
        <button onClick={onNext} className="flex-1 rounded-xl bg-indigo-700 py-3 text-sm font-semibold hover:bg-indigo-600">{last ? "Finish" : "Next"}</button>
      </div>
    </div>
  );
}
