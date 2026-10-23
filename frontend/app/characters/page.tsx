"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useCharacters } from "@/components/characters/CharactersProvider";
import { CharacterPortrait } from "@/components/characters/CharacterPortrait";
import { ErrorText } from "@/components/Modal";
import { CHARACTERS_INTRO } from "@/lib/characters";

// Step 1: a grid of characters, each a portrait with their name. Picking one opens its intro page.
export default function CharactersPage() {
  const { list, listError, reloadList } = useCharacters();

  useEffect(() => { reloadList(); }, [reloadList]); // fresh "talked to" checks every time the grid opens

  return (
    <SentenceShell title="Characters" backHref="/dashboard">
      <p className="mt-3 text-[13px] text-white/80">{CHARACTERS_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      <ErrorText text={listError} />
      {listError && <button onClick={reloadList} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm">Try again</button>}
      {!list && !listError && <p className="mt-8 text-white/60">Loading characters…</p>}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {list?.characters.map((c) => (
          <Link key={c.id} href={`/characters/${c.id}`} aria-label={c.saved > 0 ? `${c.name}, conversation started` : c.name}
            className="group relative block h-[150px] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c24] sm:h-[190px]">
            <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
              <CharacterPortrait id={c.id} emoji={c.emoji} hue={c.hue} cover={c.cover} />
            </div>
            {/* darkened top edge keeps the white name readable on any picture */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
            {c.saved > 0 && (
              <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400 bg-white text-indigo-600"><Check size={16} strokeWidth={3} /></span>
            )}
            <span lang="en" style={{ hyphens: "auto" }} className="absolute left-3 right-3 top-3 text-[15px] font-semibold leading-tight drop-shadow sm:text-base">{c.name}</span>
          </Link>
        ))}
      </div>
      {list && <p className="mt-6 text-center text-[11px] text-white/40">Pictures from <a href="https://www.wikipedia.org" target="_blank" rel="noreferrer" className="underline">Wikipedia</a></p>}
    </SentenceShell>
  );
}
