import { useParams, usePathname } from "next/navigation";

/** The topic id from /debate/<topicId>[/practice]. Reads the URL itself so it still works if the folder is not named exactly [topicId]. */
export function useDebateId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.topicId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

export const DEBATE_INTRO =
  "With the Debate mode you can argue for or against interesting and intriguing topics. Enhance your language skills as you defend your arguments against all-knowing AI.";
