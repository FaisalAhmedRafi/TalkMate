import { useParams, usePathname } from "next/navigation";
import type { DebateSide } from "@/lib/api";

/** The topic id from /debate/<topicId>[/practice]. Reads the URL itself so it still works if the folder is not named exactly [topicId]. */
export function useDebateId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.topicId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

/** Where an unfinished debate is kept, so a refresh doesn't lose the conversation. */
// the side and the translation language are part of the key, so another side or "My language" starts clean
export const debateKey = (topicId: string, side: DebateSide, language: string, level: string, native: string) =>
  `talkmate-debate:${topicId}:${side}:${language}:${level}:${native}`;

export const DEBATE_INTRO =
  "With the Debate mode you can argue for or against interesting and intriguing topics. Enhance your language skills as you defend your arguments against all-knowing AI.";
