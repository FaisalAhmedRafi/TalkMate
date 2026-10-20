import { useParams, usePathname } from "next/navigation";

/** The topic id from /dialogue/<topicId>[/practice]. Reads the URL itself so it still works if the folder is not named exactly [topicId]. */
export function useDialogueId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.topicId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

/** Where an in-progress dialogue is kept, so a refresh doesn't lose the turn the learner is on. */
// the translation language is part of the key too, so changing "My language" never reuses old translations
export const dialogueKey = (topicId: string, language: string, level: string, native: string) =>
  `talkmate-dialogue:${topicId}:${language}:${level}:${native}`;

export const DIALOGUE_INTRO =
  "With the Dialogue Mode, you can practice essential daily vocabulary with pre-scripted conversations. Learn how to speak like a native speaker in various settings.";
