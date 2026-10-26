"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useCharacters } from "@/components/characters/CharactersProvider";
import { CharacterPortrait } from "@/components/characters/CharacterPortrait";
import { CHARACTERS_INTRO, CHARACTER_MODE_TEXT, useCharacterId } from "@/lib/characters";

// Step 2: the chosen character's picture, who they are, and Start.
export default function CharacterIntroPage() {
  const characterId = useCharacterId();
  const router = useRouter();
  const { list, listError, progress } = useCharacters();
  const c = list?.characters.find((x) => x.id === characterId);

  useEffect(() => {
    if (list && !c) router.replace("/characters"); // unknown character id
  }, [list, c, router]);

  // a saved conversation is continued; "Start over" tells the chat to throw it away
  const start = (restart = false) => router.push(`/characters/${characterId}/practice${restart ? "?restart=1" : ""}`);

  return (
    <SentenceShell title="Characters" backHref="/characters">
      <p className="mt-3 text-[13px] text-white/80">{CHARACTERS_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      {listError ? (
        <p className="mt-8 text-white/60">{listError}</p>
      ) : !c ? (
        <p className="mt-8 text-white/60">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#1c1c24] p-4 sm:flex-row">
          <div className="h-64 shrink-0 overflow-hidden rounded-xl sm:h-[412px] sm:w-[310px]">
            <CharacterPortrait id={c.id} emoji={c.emoji} hue={c.hue} cover={c.cover} emojiClass="text-7xl" />
          </div>
          <div className="flex flex-1 flex-col">
            <h1 className="text-lg font-semibold">{c.name}</h1>
            <p className="mt-3 text-[13px] text-white/80">{CHARACTER_MODE_TEXT}</p>
            <p className="mt-3 text-[13px] text-white/60">{c.about}</p>
            <p className="mt-3 text-xs text-white/50">{progress.language} · {progress.level} · Feedback in {progress.nativeLanguage}</p>
            <div className="mt-6 sm:mt-auto">
              <button onClick={() => start()} className="w-full rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold hover:bg-indigo-600">
                {c.saved > 0 ? "Continue" : "Start"}
              </button>
              {c.saved > 0 && (
                <p className="mt-1.5 text-center text-[11px] text-white/50">
                  {c.saved} {c.saved === 1 ? "message" : "messages"} saved ·{" "}
                  <button onClick={() => start(true)} className="font-semibold underline hover:text-white">Start over</button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </SentenceShell>
  );
}
