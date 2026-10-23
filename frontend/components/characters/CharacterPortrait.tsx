"use client";
import { useState } from "react";
import { portraitSrc, tileBackground, USE_PORTRAITS } from "@/lib/characters";

/** A character's picture: your own portrait file when portraits are on, else the stock photo from the API (`cover`), else a gradient tile with their emoji. Fills its parent. */
export function CharacterPortrait({ id, emoji, hue, cover, emojiClass = "text-6xl" }: { id: string; emoji: string; hue: number; cover?: string | null; emojiClass?: string }) {
  const [failed, setFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  if (USE_PORTRAITS && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={portraitSrc(id)} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
    );
  }
  if (cover && !coverFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cover} alt="" loading="lazy" onError={() => setCoverFailed(true)} className="h-full w-full object-cover object-top" />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center pt-6 ${emojiClass}`} style={{ background: tileBackground(hue) }} aria-hidden="true">
      {emoji}
    </div>
  );
}
