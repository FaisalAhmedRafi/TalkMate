"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { Progress } from "@/lib/api";
import { SubPage } from "./SubPage";

type Patch = { language?: string; nativeLanguage?: string; level?: string };
export type Option = { value: string; title: string; sub: string; flag?: string };

// value = the English name the backend and AI prompts already use; sub = the name in that language.
export const LANGUAGE_OPTIONS: Option[] = [
  { value: "English", title: "English", sub: "English", flag: "gb" },
  { value: "Spanish", title: "Spanish", sub: "Español", flag: "es" },
  { value: "French", title: "French", sub: "Français", flag: "fr" },
  { value: "German", title: "German", sub: "Deutsch", flag: "de" },
  { value: "Italian", title: "Italian", sub: "Italiano", flag: "it" },
  { value: "Chinese", title: "Chinese", sub: "中文", flag: "cn" },
  { value: "Japanese", title: "Japanese", sub: "日本語", flag: "jp" },
  { value: "Korean", title: "Korean", sub: "한국어", flag: "kr" },
  { value: "Hindi", title: "Hindi", sub: "हिन्दी", flag: "in" },
  { value: "Bengali", title: "Bengali", sub: "বাংলা", flag: "bd" },
  { value: "Russian", title: "Russian", sub: "Русский", flag: "ru" },
  { value: "Arabic", title: "Arabic", sub: "العربية", flag: "sa" },
];
export const LEVEL_OPTIONS: Option[] = [
  { value: "Beginner", title: "Beginner", sub: "A1 - A2" },
  { value: "Intermediate", title: "Intermediate", sub: "B1 - B2" },
  { value: "Advanced", title: "Advanced", sub: "C1 - C2" },
];

// Flag picture; if it can't load (offline), a two-letter badge is shown instead.
function Flag({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold uppercase">{code}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://flagcdn.com/w80/${code}.png`} alt="" width={36} height={36} onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded-full object-cover" />
  );
}

/** The closed field: current choice + chevron. Opens the picker. */
export function PickerField({ label, option, onOpen }: { label: string; option: Option; onOpen: () => void }) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <button onClick={onOpen} aria-label={label}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#1f1f27] px-4 py-4 text-left transition-colors hover:border-white/30">
        {option.flag && <Flag code={option.flag} />}
        <span className="flex-1 text-sm font-semibold">
          {option.title}{!option.flag && <span className="ml-1">({option.sub})</span>}
        </span>
        <ChevronDown size={18} />
      </button>
    </div>
  );
}

/** Popup: search box, a card per option, Save button (enabled only after picking something new). */
export function Picker({ title, options, current, searchable, onSave, onClose }: {
  title: string; options: Option[]; current: string; searchable?: boolean;
  onSave: (value: string) => void; onClose: () => void;
}) {
  const [picked, setPicked] = useState(current);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.title.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q)) : options;
  const changed = picked !== current;

  return (
    <Modal onClose={onClose} label={title}>
      <h2 className="pr-8 text-lg font-semibold">{title}</h2>

      {searchable && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-4 focus-within:border-white/30">
          <Search size={20} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search languages" aria-label="Search languages"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-white/50" />
        </div>
      )}

      <ul className={`${searchable ? "mt-5" : "mt-6"} max-h-[50vh] space-y-3 overflow-y-auto pr-1`}>
        {shown.map((o) => (
          <li key={o.value}>
            <button onClick={() => setPicked(o.value)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${picked === o.value ? "border-white" : "border-white/10 hover:border-white/30"}`}>
              {o.flag && <Flag code={o.flag} />}
              <span>
                <span className="block text-sm font-semibold">{o.title}</span>
                <span className="block text-xs text-white/60">{o.sub}</span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-white/60">No results</li>}
      </ul>

      <button disabled={!changed} onClick={() => onSave(picked)}
        className={`mt-5 w-full rounded-2xl py-4 text-sm font-semibold transition-colors ${changed ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/40"}`}>
        Save
      </button>
    </Modal>
  );
}

type Field = "native" | "target" | "level";

export function SettingsView({ s, onBack, onSettings, onToast }: {
  s: Progress; onBack: () => void; onSettings: (patch: Patch) => void; onToast: (message: string) => void;
}) {
  const [open, setOpen] = useState<Field | null>(null);
  const find = (list: Option[], v: string) => list.find((o) => o.value === v) ?? list[0];
  const save = (patch: Patch) => { onSettings(patch); onToast("Saved"); setOpen(null); };

  return (
    <SubPage title="Settings" subtitle="Manage your account settings below." onBack={onBack}>
      <div className="space-y-6">
        <PickerField label="Choose translation language" option={find(LANGUAGE_OPTIONS, s.nativeLanguage)} onOpen={() => setOpen("native")} />
        <PickerField label="Choose target language" option={find(LANGUAGE_OPTIONS, s.language)} onOpen={() => setOpen("target")} />
        <PickerField label="Change your target language level" option={find(LEVEL_OPTIONS, s.level)} onOpen={() => setOpen("level")} />
      </div>

      {open === "native" && (
        <Picker title="Choose translation language" options={LANGUAGE_OPTIONS} current={s.nativeLanguage} searchable
          onSave={(v) => save({ nativeLanguage: v })} onClose={() => setOpen(null)} />
      )}
      {open === "target" && (
        <Picker title="Choose target language" options={LANGUAGE_OPTIONS} current={s.language} searchable
          onSave={(v) => save({ language: v })} onClose={() => setOpen(null)} />
      )}
      {open === "level" && (
        <Picker title="Change your target language level" options={LEVEL_OPTIONS} current={s.level}
          onSave={(v) => save({ level: v })} onClose={() => setOpen(null)} />
      )}
    </SubPage>
  );
}
