"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimer } from "@/components/PracticeTimer";
import { api, getToken, type Progress } from "@/lib/api";

type Patch = { language?: string; nativeLanguage?: string; level?: string };
type Ctx = { progress: Progress; updateSettings: (patch: Patch) => Promise<void> };
const CallCtx = createContext<Ctx | null>(null);

export const useCall = () => {
  const c = useContext(CallCtx);
  if (!c) throw new Error("useCall must be used inside CallProvider");
  return c;
};

/** Gate for /call: needs a login and Premium, and loads language, level and native language once. */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        if (!p.premium) { router.replace("/dashboard"); return; } // same Premium rule as the Home screen
        setProgress(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router]);

  // Not optimistic: the Call page starts a new call when the target language changes, and the server must already know the new one by then.
  const updateSettings = useCallback(async (patch: Patch) => {
    setProgress(await api.progress.settings(patch));
  }, []);

  if (!progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{error ?? "Loading…"}</p>
        {error && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <CallCtx.Provider value={{ progress, updateSettings }}>
      <div className="min-h-screen bg-[#16161c] text-white">
        <PracticeTimer onSnapshot={setProgress} />
        {children}
      </div>
    </CallCtx.Provider>
  );
}
