"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useDebate } from "@/components/debate/DebateProvider";
import { ErrorText } from "@/components/Modal";
import { DEBATE_INTRO } from "@/lib/debate";

// Step 1: a grid of topics, each a picture with its title. Picking one opens its intro page.
export default function DebateTopicsPage() {
  const { topics, topicsError, reloadTopics } = useDebate();

  useEffect(() => { reloadTopics(); }, [reloadTopics]);

  return (
    <SentenceShell title="Debates" backHref="/dashboard">
      <p className="mt-3 text-[13px] text-white/80">{DEBATE_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      <ErrorText text={topicsError} />
      {topicsError && <button onClick={reloadTopics} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm">Try again</button>}
      {!topics && !topicsError && <p className="mt-8 text-white/60">Loading debates…</p>}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {topics?.topics.map((t) => (
          <Link key={t.id} href={`/debate/${t.id}`} aria-label={t.debated ? `${t.title}, debated` : t.title}
            className="group relative block h-[150px] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c24] sm:h-[190px]">
            {t.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 pt-6 text-6xl">{t.emoji}</div>
            )}
            {/* darkened top edge keeps the white title readable on any picture */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
            {t.debated && (
              <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400 bg-white text-indigo-600"><Check size={16} strokeWidth={3} /></span>
            )}
            <span lang="en" style={{ hyphens: "auto" }} className="absolute left-3 right-3 top-3 text-[15px] font-semibold leading-tight drop-shadow sm:text-base">{t.title}</span>
          </Link>
        ))}
      </div>
      {topics && <p className="mt-6 text-center text-[11px] text-white/40">Photos from <a href="https://pixabay.com" target="_blank" rel="noreferrer" className="underline">Pixabay</a> and <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">Pexels</a></p>}
    </SentenceShell>
  );
}
