import { useParams, usePathname } from "next/navigation";

/** The character id from /characters/<characterId>[/practice]. Reads the URL itself so it still works if the folder is not named exactly [characterId]. */
export function useCharacterId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.characterId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

export const CHARACTERS_INTRO =
  "Engage in dynamic conversations with historical or fictional characters, practicing listening, speaking, and contextual understanding in immersive, interactive scenarios.";

export const CHARACTER_MODE_TEXT = "In the Character Mode you can chat and personally get to know famous historical and fictional characters.";

/** Set NEXT_PUBLIC_CHARACTER_PORTRAITS=1 once portrait images exist as public/characters/<id>.jpg; until then every tile is a colour gradient with an emoji. */
export const USE_PORTRAITS = process.env.NEXT_PUBLIC_CHARACTER_PORTRAITS === "1";

export const portraitSrc = (id: string) => `/characters/${id}.jpg`;

/** The fallback tile background, built from the character's hue. */
export const tileBackground = (hue: number) =>
  `linear-gradient(160deg, hsl(${hue} 45% 38%) 0%, hsl(${(hue + 20) % 360} 40% 14%) 100%)`;
