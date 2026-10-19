import { useParams, usePathname } from "next/navigation";

/** The topic id from /flashcards/<topicId> ("review" is the Daily review). Reads the URL itself so it still works if the folder is not named exactly [topicId]. */
export function useTopicId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.topicId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}
