"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimer } from "@/components/PracticeTimer";
import { api, getToken, type DialogueTopics, type Progress } from "@/lib/api";

type Ctx = {
  progress: Progress;
  topics: DialogueTopics | null;
  topicsError: string | null;
  reloadTopics: () => void;
};
const DialogueCtx = createContext<Ctx | null>(null);

export const useDialogue = () => {
  const c = useContext(DialogueCtx);
  if (!c) throw new Error("useDialogue must be used inside DialogueProvider");
  return c;
};

/** Gate for every /dialogue page: needs a login and Premium, and loads language, level and the topic grid once. */
export function DialogueProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [topics, setTopics] = useState<DialogueTopics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const reloadTopics = useCallback(() => {
    setTopicsError(null);
    api.dialogue.topics().then(setTopics).catch((e) => setTopicsError(e instanceof Error ? e.message : "Couldn't load the dialogues"));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        if (!p.premium) { router.replace("/dashboard"); return; } // same Premium rule as the Home screen
        setProgress(p);
        reloadTopics();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router, reloadTopics]);

  if (!progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{error ?? "Loading…"}</p>
        {error && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <DialogueCtx.Provider value={{ progress, topics, topicsError, reloadTopics }}>
      <div className="min-h-screen bg-[#16161c] text-white">
        <PracticeTimer onSnapshot={setProgress} />
        {children}
      </div>
    </DialogueCtx.Provider>
  );
}
