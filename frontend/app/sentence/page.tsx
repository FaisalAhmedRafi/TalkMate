"use client";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useSentence } from "@/components/sentence/SentenceProvider";
import { ErrorText } from "@/components/Modal";

// Page 0: every unit and its skills, with overall progress.
export default function SentenceUnitsPage() {
  const { units, unitsError, reloadUnits } = useSentence();
  const percent = units?.percent ?? 0;

  return (
    <SentenceShell title="Sentence Mode" backHref="/dashboard">
      <p className="mt-3 text-[13px] text-white/80">
        The Sentence Mode is a unique way to learn everyday phrases. This interactive mode creates an engaging
        learning environment, helping you improve your pronunciation skills.
      </p>
      <hr className="mt-4 border-white/10" />

      <div className="mt-5 flex items-center gap-2" aria-label={`Course progress ${percent}%`}>
        <span className="z-[1] rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">{percent}%</span>
        <div className="-ml-4 h-1 flex-1 overflow-hidden rounded-full bg-indigo-300/60">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ErrorText text={unitsError} />
      {unitsError && <button onClick={reloadUnits} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm">Try again</button>}
      {!units && !unitsError && <p className="mt-8 text-white/60">Loading units…</p>}

      {units?.units.map((u) => (
        <section key={u.number} className="mt-8">
          <p className="text-xs font-semibold text-indigo-300">Unit {u.number}</p>
          <h2 className="mt-1 text-base font-semibold">{u.title}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {u.skills.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/sentence/${k.id}`}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-[#1f1f27] px-4 py-3 transition-colors hover:border-white/20"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xl">{k.emoji}</span>
                  <span className="flex-1 text-[13px] font-semibold">{k.title}</span>
                  {k.passed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300">
                      <Check size={14} /> {k.bestScore.toFixed(1)}/5
                    </span>
                  ) : (
                    <ChevronRight size={16} className="text-white/40" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </SentenceShell>
  );
}
