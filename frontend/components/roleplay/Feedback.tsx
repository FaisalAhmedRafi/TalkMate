"use client";
import { AlertTriangle, Check, Languages, Loader2, User, Volume2 } from "lucide-react";
import type { Msg, RoleplayFeedback } from "@/lib/api";

// Keyed by the message's index in the chat
export type Review = { state: "loading" } | { state: "error"; error: string } | { state: "done"; data: RoleplayFeedback };

/** The small status under a learner's bubble: checking, correct or needs a fix. */
export function ReviewBadge({ r, onOpen }: { r?: Review; onOpen: () => void }) {
  if (!r) return null;
  const base = "flex items-center gap-1 text-[11px] font-medium";
  return (
    <button onClick={onOpen} className="text-left" aria-label="Open the feedback for this message">
      {r.state === "loading" ? <span className={`${base} text-white/50`}><Loader2 size={12} className="animate-spin" /> Checking…</span>
        : r.state === "error" ? <span className={`${base} text-white/50`}><AlertTriangle size={12} /> Couldn&apos;t check</span>
        : r.data.correct ? <span className={`${base} text-green-400`}><Check size={12} strokeWidth={3} /> Correct</span>
        : <span className={`${base} text-amber-400`}><AlertTriangle size={12} /> Can be improved</span>}
    </button>
  );
}

/** Shown until the learner has sent a message: what the panel will do. */
export function FeedbackEmpty() {
  const dot = "flex h-6 w-6 items-center justify-center rounded-full text-white";
  return (
    <div className="m-auto flex flex-col items-center px-6 text-center">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 px-5 py-3">
        <span className={`${dot} bg-green-600`}><Check size={14} strokeWidth={3} /></span>
        <span className={`${dot} bg-amber-500`}><AlertTriangle size={13} /></span>
        <span className={`${dot} bg-white/15`}><Languages size={13} /></span>
        <span className={`${dot} bg-white/15`}><User size={13} /></span>
      </div>
      <p className="mt-6 text-sm font-semibold">Get feedback on messages</p>
      <p className="mt-2 text-xs text-white/70">AI will assess your messages and give you personalized feedback.</p>
    </div>
  );
}

/** One card per learner message: the verdict, the fixed sentence, why, the translation and a Listen button. */
export function FeedbackList({ msgs, reviews, speaking, lang, learnerLang, onSpeak, onRetry, end }: {
  msgs: Msg[]; reviews: Record<number, Review>; speaking: string | null; lang: string; learnerLang: string;
  onSpeak: (id: string, text: string) => void; onRetry: (i: number) => void; end: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {msgs.map((m, i) => {
        const r = reviews[i];
        if (m.role !== "user" || !r) return null;
        const d = r.state === "done" ? r.data : null;
        const say = d && !d.correct && d.corrected ? d.corrected : m.content; // hear the fixed line when there is one
        return (
          <article key={i} className="rounded-xl bg-[#26262d] p-4 text-sm">
            <p className="text-white/70" lang={lang}>“{m.content}”</p>
            {r.state === "loading" && <p className="mt-3 flex items-center gap-2 text-xs text-white/60"><Loader2 size={14} className="animate-spin" /> Checking your message…</p>}
            {r.state === "error" && (
              <div className="mt-3">
                <p className="text-xs text-red-300">{r.error}</p>
                <button onClick={() => onRetry(i)} className="mt-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20">Try again</button>
              </div>
            )}
            {d && (
              <>
                <p className={`mt-3 flex items-center gap-2 text-xs font-semibold ${d.correct ? "text-green-400" : "text-amber-400"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${d.correct ? "bg-green-600" : "bg-amber-500"}`}>
                    {d.correct ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={11} />}
                  </span>
                  {d.correct ? "Correct" : "Can be improved"}
                </p>
                {!d.correct && d.corrected && (
                  <p className="mt-2 rounded-lg bg-green-500/10 px-3 py-2 text-green-200" lang={lang}>{d.corrected}</p>
                )}
                {d.explanation && <p className="mt-2 text-white/80">{d.explanation}</p>}
                {d.translation && (
                  <p className="mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-xs text-white/60">
                    <Languages size={14} className="mt-0.5 shrink-0" aria-label={`Translation in ${learnerLang}`} /> {d.translation}
                  </p>
                )}
                <button onClick={() => onSpeak(`r${i}`, say)} aria-label="Hear this sentence"
                  className={`mt-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 ${speaking === `r${i}` ? "animate-pulse" : ""}`}>
                  <Volume2 size={14} /> Listen
                </button>
              </>
            )}
          </article>
        );
      })}
      <div ref={end} />
    </div>
  );
}
