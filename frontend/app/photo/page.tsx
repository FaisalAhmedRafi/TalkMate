"use client";
import Link from "next/link";
import { Star } from "lucide-react";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { usePhoto } from "@/components/photo/PhotoProvider";
import { ErrorText } from "@/components/Modal";

// Photo Mode home: units of 8 stars (2 rows of 4). Each star is one photo to describe.
export default function PhotoUnitsPage() {
  const { units, unitsError, reloadUnits } = usePhoto();
  const percent = units?.percent ?? 0;

  return (
    <SentenceShell title="Photo Mode" backHref="/dashboard">
      <p className="mt-3 text-[13px] text-white/80">Describe a photo and receive contextual and grammatical feedback.</p>
      <hr className="mt-4 border-white/10" />

      <div className="mt-5 flex items-center gap-2" aria-label={`Course progress ${percent}%`}>
        <span className="z-[1] rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">{percent}%</span>
        <div className="-ml-4 h-1 flex-1 overflow-hidden rounded-full bg-indigo-300/60">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ErrorText text={unitsError} />
      {unitsError && <button onClick={reloadUnits} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm">Try again</button>}
      {!units && !unitsError && <p className="mt-8 text-white/60">Loading photos…</p>}

      {units?.units.map((u) => {
        const done = u.photos.filter((p) => p.passed).length;
        return (
          <section key={u.number} className="relative mt-9 rounded-2xl border border-indigo-900/70 bg-[#1c1c24] p-3 pt-5" aria-label={`Unit ${u.number}`}>
            <span className="absolute -top-3 left-5 rounded-full bg-indigo-700 px-3 py-1 text-xs font-semibold">Unit {u.number}</span>
            <span className="absolute -top-3 right-4 rounded-full border border-indigo-900 bg-[#16161c] px-2.5 py-0.5 text-xs font-bold">
              {done}<span className="font-normal text-white/30">/{u.photos.length}</span>
            </span>
            {/* 4 stars per row, each tile the same size as a Word Mode tile (one sixth of the row) */}
            <div className="grid justify-center gap-2" style={{ gridTemplateColumns: "repeat(4, calc((100% - 2.5rem) / 6))" }}>
              {u.photos.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/photo/${p.id}`}
                  aria-label={`Photo ${i + 1} of unit ${u.number}${p.passed ? ", completed" : ""}`}
                  className="flex aspect-[1/0.95] items-center justify-center rounded-xl border border-white/10 bg-[#202029] transition-colors hover:bg-[#262633]"
                >
                  <Star size={22} className={p.passed ? "fill-yellow-400 text-yellow-400" : "fill-indigo-500/70 text-indigo-400/70"} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </SentenceShell>
  );
}
