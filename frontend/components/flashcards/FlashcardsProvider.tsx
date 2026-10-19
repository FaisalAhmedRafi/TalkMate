"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimer } from "@/components/PracticeTimer";
import { api, getToken, type FlashTopics, type Progress } from "@/lib/api";

type Ctx = {
  progress: Progress;
  topics: FlashTopics | null;
  topicsError: string | null;
  reloadTopics: () => void;
};
const FlashCtx = createContext<Ctx | null>(null);

export const useFlashcards = () => {
  const c = useContext(FlashCtx);
  if (!c) throw new Error("useFlashcards must be used inside FlashcardsProvider");
  return c;
};

/** Gate for every /flashcards page: needs a login and Premium, and loads language and level once. The topic grid loads itself (see reloadTopics). */
export function FlashcardsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [topics, setTopics] = useState<FlashTopics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const reloadTopics = useCallback(() => {
    setTopicsError(null);
    api.flashcards.topics().then(setTopics).catch((e) => setTopicsError(e instanceof Error ? e.message : "Couldn't load the flashcards"));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        if (!p.premium) { router.replace("/dashboard"); return; } // same Premium rule as the Home screen
        setProgress(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router]);

  if (!progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{error ?? "Loading…"}</p>
        {error && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <FlashCtx.Provider value={{ progress, topics, topicsError, reloadTopics }}>
      <div className="min-h-screen bg-[#16161c] text-white">
        <PracticeTimer onSnapshot={setProgress} />
        {children}
      </div>
    </FlashCtx.Provider>
  );
}
