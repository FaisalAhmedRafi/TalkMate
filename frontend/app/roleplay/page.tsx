"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useRoleplay } from "@/components/roleplay/RoleplayProvider";
import { ErrorText } from "@/components/Modal";
import { ROLEPLAY_INTRO } from "@/lib/roleplay";

// Step 1: a grid of scenarios, each a picture with its title and a category pill. Picking one opens its intro page.
export default function RoleplayScenariosPage() {
  const { scenarios, scenariosError, reloadScenarios } = useRoleplay();

  useEffect(() => { reloadScenarios(); }, [reloadScenarios]); // fresh check marks after a chat

  return (
    <SentenceShell title="Roleplays" backHref="/dashboard">
      <p className="mt-3 text-[13px] text-white/80">{ROLEPLAY_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      <ErrorText text={scenariosError} />
      {scenariosError && <button onClick={reloadScenarios} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm">Try again</button>}
      {!scenarios && !scenariosError && <p className="mt-8 text-white/60">Loading roleplays…</p>}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {scenarios?.scenarios.map((s) => (
          <Link key={s.id} href={`/roleplay/${s.id}`} aria-label={`${s.title}, ${s.category}${s.practiced ? ", practised" : ""}`}
            className="group relative block aspect-[7/5] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c24]">
            {s.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 pt-6 text-6xl">{s.emoji}</div>
            )}
            {/* darkened top edge keeps the white title readable on any picture */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
            <span lang="en" style={{ hyphens: "auto" }} className="absolute left-3 right-3 top-3 text-[15px] font-semibold leading-tight drop-shadow sm:text-base">{s.title}</span>
            <span className="absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium leading-none text-[#16161c]">{s.category}</span>
            {s.practiced && (
              <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400 bg-white text-indigo-600"><Check size={16} strokeWidth={3} /></span>
            )}
          </Link>
        ))}
      </div>
      {scenarios && <p className="mt-6 text-center text-[11px] text-white/40">Photos from <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">Pexels</a></p>}
    </SentenceShell>
  );
}
