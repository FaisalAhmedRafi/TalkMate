"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimer } from "@/components/PracticeTimer";
import { api, getToken, type CharacterList, type Progress } from "@/lib/api";

type Ctx = {
  progress: Progress;
  list: CharacterList | null;
  listError: string | null;
  reloadList: () => void;
};
const CharactersCtx = createContext<Ctx | null>(null);

export const useCharacters = () => {
  const c = useContext(CharactersCtx);
  if (!c) throw new Error("useCharacters must be used inside CharactersProvider");
  return c;
};

/** Gate for every /characters page: needs a login and Premium, and loads language, level and the character grid once. */
export function CharactersProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [list, setList] = useState<CharacterList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const reloadList = useCallback(() => {
    setListError(null);
    api.characters.list().then(setList).catch((e) => setListError(e instanceof Error ? e.message : "Couldn't load the characters"));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        if (!p.premium) { router.replace("/dashboard"); return; } // same Premium rule as the Home screen
        setProgress(p);
        reloadList();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router, reloadList]);

  if (!progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{error ?? "Loading…"}</p>
        {error && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <CharactersCtx.Provider value={{ progress, list, listError, reloadList }}>
      <div className="min-h-screen bg-[#16161c] text-white">
        <PracticeTimer onSnapshot={setProgress} />
        {children}
      </div>
    </CharactersCtx.Provider>
  );
}
