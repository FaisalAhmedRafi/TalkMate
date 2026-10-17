"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { api, type PersonalizationData } from "@/lib/api";
import { SubPage } from "./SubPage";

export function PersonalizationView({ onBack, onToast }: { onBack: () => void; onToast: (message: string) => void }) {
  const [data, setData] = useState<PersonalizationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.account.personalization().then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your answers"));
  }, []);

  // Every change is saved on its own; if saving fails the old answer comes back.
  const change = (key: string, value: string) => {
    if (!data) return;
    const before = data;
    setData({ ...data, values: { ...data.values, [key]: value } });
    api.account.savePersonalization({ [key]: value })
      .then(() => onToast("Saved"))
      .catch((e) => { setData(before); onToast(e instanceof Error ? e.message : "Couldn't save"); });
  };

  return (
    <SubPage title="Personalization" subtitle="Adapt the app to your needs." onBack={onBack}>
      <ErrorText text={error} />
      {!data && !error && <p className="text-white/60">Loading…</p>}
      <div className="space-y-6">
        {data?.questions.map((q) => (
          <div key={q.key}>
            <label htmlFor={`q-${q.key}`} className="text-sm font-semibold">{q.label}</label>
            <div className="relative mt-3">
              <select id={`q-${q.key}`} value={data.values[q.key] ?? ""} onChange={(e) => change(q.key, e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-[#1f1f27] px-4 py-4 pr-10 text-sm font-semibold outline-none [color-scheme:dark] focus:ring-2 focus:ring-indigo-500">
                <option value="" disabled>Select an option</option>
                {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        ))}
      </div>
    </SubPage>
  );
}
