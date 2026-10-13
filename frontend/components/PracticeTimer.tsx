"use client";
import { useEffect, useRef } from "react";
import { api, type Progress } from "@/lib/api";
import { localDay } from "@/lib/dates";

/**
 * Mount this while a practice screen is open. It counts the seconds the tab is visible
 * and reports them to the server every 30 seconds, and once more when it unmounts.
 */
export function PracticeTimer({ onSnapshot }: { onSnapshot: (p: Progress) => void }) {
  const cb = useRef(onSnapshot);
  cb.current = onSnapshot;

  useEffect(() => {
    let pending = 0;
    const flush = (keepalive = false) => {
      const s = Math.min(pending, 60);
      if (s < 1) return;
      pending -= s;
      api.progress.time(s, localDay(), keepalive).then((p) => cb.current(p)).catch(() => {});
    };
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pending += 1;
      if (pending >= 30) flush();
    }, 1000);
    return () => {
      clearInterval(id);
      flush(true);
    };
  }, []);

  return null;
}
