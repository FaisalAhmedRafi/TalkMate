import { useParams, usePathname } from "next/navigation";

/** The scenario id from /roleplay/<scenarioId>[/practice]. Reads the URL itself so it still works if the folder is not named exactly [scenarioId]. */
export function useRoleplayId(): string {
  const params = useParams();
  const path = usePathname() ?? "";
  const p = params?.scenarioId;
  if (typeof p === "string" && p) return p;
  return decodeURIComponent(path.split("/")[2] ?? "");
}

export const ROLEPLAY_INTRO =
  "With the Roleplay mode practicing language will be fun and exciting. You can pick various settings from daily conversations to creative and fantastic dialogues.";
