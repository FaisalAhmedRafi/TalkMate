import { useParams, usePathname } from "next/navigation";
import type { WordUnits } from "@/lib/api";

/** The word id from /word/<wordId>. Reads the URL itself so it still works if the folder is not named exactly [wordId]. */
export function useWordId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.wordId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

/** The word after this one in the grid (the next star), or null at the very end. */
export function nextWordId(units: WordUnits | null, id: string): string | null {
  const all = units?.units.flatMap((u) => u.words.map((w) => w.id)) ?? [];
  const i = all.indexOf(id);
  return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
}
