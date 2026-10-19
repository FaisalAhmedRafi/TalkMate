"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Star, X } from "lucide-react";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useWord } from "@/components/word/WordProvider";
import { ErrorText } from "@/components/Modal";

// Word Mode home: ten units of twelve stars. Each star is one word lesson.
export default function WordUnitsPage() {
  const router = useRouter();
  const { units, unitsError, reloadUnits } = useWord();
  const [ask, setAsk] = useState<string | null>(null); // the word waiting on the "Ready to get back?" popup
  const percent = units?.percent ?? 0;

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAsk(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  // A lesson that was opened but not finished asks first; anything else just starts from the beginning.
  const open = (id: string, inProgress: boolean) => (inProgress ? setAsk(id) : router.push(`/word/${id}`));

  return (
    <SentenceShell title="Word Mode" backHref="/dashboard">
      <p className="mt-3 text-[13px] text-white/80">Learn basic vocabulary with the word decks.</p>
      <hr className="mt-4 border-white/10" />

      <div className="mt-5 flex items-center gap-2" aria-label={`Course progress ${percent}%`}>
        <span className="z-[1] rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">{percent}%</span>
        <div className="-ml-4 h-1 flex-1 overflow-hidden rounded-full bg-indigo-300/60">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ErrorText text={unitsError} />
      {unitsError && <button onClick={reloadUnits} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm">Try again</button>}
      {!units && !unitsError && <p className="mt-8 text-white/60">Loading words…</p>}

      {units?.units.map((u) => {
        const done = u.words.filter((w) => w.passed).length;
        return (
          <section key={u.number} className="relative mt-9 rounded-2xl border border-indigo-900/70 bg-[#1c1c24] p-3 pt-5" aria-label={`Unit ${u.number}: ${u.title}`}>
            <span className="absolute -top-3 left-5 rounded-full bg-indigo-700 px-3 py-1 text-xs font-semibold">Unit {u.number}</span>
            <span className="absolute -top-3 right-4 rounded-full border border-indigo-900 bg-[#16161c] px-2.5 py-0.5 text-xs font-bold">
              {done}<span className="font-normal text-white/30">/{u.words.length}</span>
            </span>
            <div className="grid grid-cols-6 gap-2">
              {u.words.map((w, i) => (
                <button
                  key={w.id}
                  onClick={() => open(w.id, w.inProgress)}
                  aria-label={`Word ${i + 1} of unit ${u.number}${w.passed ? ", completed" : w.inProgress ? ", in progress" : ""}`}
                  className={`relative flex aspect-[1/0.95] items-center justify-center rounded-xl border bg-[#202029] transition-colors hover:bg-[#262633] ${
                    w.inProgress ? "border-indigo-400/70" : "border-white/10"
                  }`}
                >
                  <Star
                    size={22}
                    className={w.passed ? "fill-yellow-400 text-yellow-400" : w.inProgress ? "fill-indigo-400 text-indigo-300" : "fill-indigo-500/70 text-indigo-400/70"}
                  />
                  {w.inProgress && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-300" />}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {ask && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setAsk(null)}>
          <div role="dialog" aria-label="Continue this word?" onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[350px] rounded-3xl bg-[#1c1c22] p-6 text-center shadow-2xl">
            <button onClick={() => setAsk(null)} aria-label="Close" className="absolute right-5 top-5 text-white/80 hover:text-white"><X size={18} /></button>
            <div className="mx-auto mt-6 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-black"><BookOpen size={34} className="text-indigo-300" /></div>
            <h2 className="mt-6 text-lg font-semibold">Ready to get back?</h2>
            <p className="mt-3 text-sm text-white/80">Your progress is saved, you can continue where you left off or start over.</p>
            <button onClick={() => router.push(`/word/${ask}`)} className="mt-6 w-full rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold hover:bg-indigo-600">
              Continue the exercise
            </button>
            <button onClick={() => router.push(`/word/${ask}?restart=1`)} className="mt-3 w-full rounded-xl border border-white/20 py-3.5 text-sm font-semibold hover:bg-white/5">
              Start over
            </button>
          </div>
        </div>
      )}
    </SentenceShell>
  );
}
