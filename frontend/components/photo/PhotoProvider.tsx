"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PracticeTimer } from "@/components/PracticeTimer";
import { api, getToken, type PhotoUnits, type Progress } from "@/lib/api";

type Ctx = {
  progress: Progress;
  units: PhotoUnits | null;
  unitsError: string | null;
  reloadUnits: () => void;
  setProgress: (p: Progress) => void;
};
const PhotoCtx = createContext<Ctx | null>(null);

export const usePhoto = () => {
  const c = useContext(PhotoCtx);
  if (!c) throw new Error("usePhoto must be used inside PhotoProvider");
  return c;
};

/** Gate for every /photo page: needs a login and Premium, and loads language, level and the star grid once. */
export function PhotoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [units, setUnits] = useState<PhotoUnits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  const reloadUnits = useCallback(() => {
    setUnitsError(null);
    api.photos.units().then(setUnits).catch((e) => setUnitsError(e instanceof Error ? e.message : "Couldn't load the photos"));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        if (!p.premium) { router.replace("/dashboard"); return; } // same Premium rule as the Home screen
        setProgress(p);
        reloadUnits();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router, reloadUnits]);

  if (!progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{error ?? "Loading…"}</p>
        {error && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <PhotoCtx.Provider value={{ progress, units, unitsError, reloadUnits, setProgress }}>
      <div className="min-h-screen bg-[#16161c] text-white">
        <PracticeTimer onSnapshot={setProgress} />
        {children}
      </div>
    </PhotoCtx.Provider>
  );
}
