"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimer } from "@/components/PracticeTimer";
import { api, getToken, type Progress, type RoleplayScenarios } from "@/lib/api";

type Ctx = {
  progress: Progress;
  scenarios: RoleplayScenarios | null;
  scenariosError: string | null;
  reloadScenarios: () => void;
};
const RoleplayCtx = createContext<Ctx | null>(null);

export const useRoleplay = () => {
  const c = useContext(RoleplayCtx);
  if (!c) throw new Error("useRoleplay must be used inside RoleplayProvider");
  return c;
};

/** Gate for every /roleplay page: needs a login and Premium, and loads language, level and the scenario grid once. */
export function RoleplayProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [scenarios, setScenarios] = useState<RoleplayScenarios | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenariosError, setScenariosError] = useState<string | null>(null);

  const reloadScenarios = useCallback(() => {
    setScenariosError(null);
    api.roleplay.scenarios().then(setScenarios).catch((e) => setScenariosError(e instanceof Error ? e.message : "Couldn't load the roleplays"));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        if (!p.premium) { router.replace("/dashboard"); return; } // same Premium rule as the Home screen
        setProgress(p);
        reloadScenarios();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router, reloadScenarios]);

  if (!progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{error ?? "Loading…"}</p>
        {error && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <RoleplayCtx.Provider value={{ progress, scenarios, scenariosError, reloadScenarios }}>
      <div className="min-h-screen bg-[#16161c] text-white">
        <PracticeTimer onSnapshot={setProgress} />
        {children}
      </div>
    </RoleplayCtx.Provider>
  );
}
