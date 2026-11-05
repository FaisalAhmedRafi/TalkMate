"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, PhoneOff, Trash2 } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { LANGUAGE_OPTIONS, LEVEL_OPTIONS, Picker, PickerField } from "@/components/account/SettingsView";
import { api, type CallHistoryItem, type Progress } from "@/lib/api";
import { SPEEDS, tutorImg } from "@/lib/chat";
import type { CallPrefs } from "@/lib/call";

const BLUE = "bg-[#2f39c8] hover:bg-[#3a45d8]";

/** 75 -> "1:15", 3700 -> "1:01:40" */
export const duration = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "Call history": the earlier calls (tutor, length, date), or an empty state with a "Start a new call" button. */
export function CallHistoryModal({ onOpen, onNew, onClose }: { onOpen: (id: string) => void; onNew: () => void; onClose: () => void }) {
  const [calls, setCalls] = useState<CallHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.call.history().then((r) => setCalls(r.calls)).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your calls"));
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this call? This can't be undone.")) return;
    try { await api.call.remove(id); setCalls((c) => c?.filter((x) => x.id !== id) ?? c); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete this call"); }
  };

  return (
    <Modal onClose={onClose} label="Call history">
      <h2 className="text-lg font-semibold">Call history</h2>
      <ErrorText text={error} />
      {!calls && !error && <div className="flex justify-center py-24 text-white/70"><Loader2 className="animate-spin" /></div>}
      {calls && calls.length === 0 && (
        <div className="flex min-h-[420px] flex-col">
          <div className="m-auto flex flex-col items-center text-center">
            <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white/10"><PhoneOff size={28} /></span>
            <p className="mt-6 text-sm font-semibold">Call history empty</p>
            <p className="mt-3 max-w-[300px] text-xs text-white/75">You don&apos;t have any saved calls. Once you start a new call, old ones will appear here.</p>
          </div>
          <button onClick={onNew} className="mt-8 w-full rounded-2xl bg-[#43455a] py-5 text-sm font-semibold hover:bg-[#4d5066]">Start a new call</button>
        </div>
      )}
      {calls && calls.length > 0 && (
        <ul className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {calls.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-2xl border border-white/10 hover:border-white/30">
              <button onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tutorImg(c.tutor)} alt="" className="h-11 w-11 shrink-0 rounded-full bg-[#f7f7fc] object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.title || "Call"}</span>
                  <span className="mt-1 block text-xs text-white/60">{c.tutor} · {duration(c.seconds)} · {when(c.updatedAt)}</span>
                </span>
              </button>
              <button onClick={() => remove(c.id)} aria-label="Delete this call" className="mr-3 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** "Are you sure you want to start a new call?" */
export function NewCallConfirm({ onYes, onCancel }: { onYes: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel} label="Start a new call">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><AlertCircle size={22} /></span>
      <h2 className="mt-6 pr-4 text-2xl font-semibold leading-tight">Are you sure you want to start a new call?</h2>
      <p className="mt-4 text-sm text-white/75">Your current call will be moved to your call history.</p>
      <button onClick={onYes} className="mt-8 w-full rounded-2xl bg-[#43455a] py-5 text-sm font-semibold hover:bg-[#4d5066]">Yes</button>
      <button onClick={onCancel} className={`mt-3 w-full rounded-2xl py-5 text-sm font-semibold text-white ${BLUE}`}>Cancel</button>
    </Modal>
  );
}

type Patch = { language?: string; nativeLanguage?: string; level?: string };
type Field = "native" | "target" | "level";

/** Call "Settings": the language pickers and the voice speed. */
export function CallSettings({ progress, prefs, onPrefs, onSettings, onClose }: {
  progress: Progress; prefs: CallPrefs; onPrefs: (patch: Partial<CallPrefs>) => void;
  onSettings: (patch: Patch) => Promise<void>; onClose: () => void;
}) {
  const [open, setOpen] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);
  const find = (list: typeof LANGUAGE_OPTIONS, v: string) => list.find((o) => o.value === v) ?? list[0];
  const save = (patch: Patch) => { setOpen(null); setError(null); onSettings(patch).catch((e) => setError(e instanceof Error ? e.message : "Couldn't save")); };

  return (
    <>
      <Modal onClose={onClose} label="Settings">
        <h2 className="text-xl font-semibold">Settings</h2>
        <ErrorText text={error} />
        <div className="mt-6 space-y-6">
          <PickerField label="Choose translation language" option={find(LANGUAGE_OPTIONS, progress.nativeLanguage)} onOpen={() => setOpen("native")} />
          <PickerField label="Choose target language" option={find(LANGUAGE_OPTIONS, progress.language)} onOpen={() => setOpen("target")} />
          <PickerField label="Change your target language level" option={find(LEVEL_OPTIONS, progress.level)} onOpen={() => setOpen("level")} />

          <div>
            <p className="mb-3 text-sm font-semibold">Voice speed</p>
            <div className="rounded-2xl border border-white/10 px-4 pb-5 pt-4">
              <div className="flex justify-between text-[11px] font-semibold text-white/80"><span>Slow</span><span>Fast</span></div>
              <input type="range" min={0} max={SPEEDS.length - 1} step={1} value={prefs.speed} aria-label="Voice speed"
                aria-valuetext={`${SPEEDS[prefs.speed]}x`} onChange={(e) => onPrefs({ speed: Number(e.target.value) })}
                className="mt-3 h-2 w-full cursor-pointer accent-[#2f39c8]" />
              <p className="mt-2 text-center text-sm font-semibold">{SPEEDS[prefs.speed]}x</p>
            </div>
          </div>
        </div>
      </Modal>

      {open === "native" && <Picker title="Choose translation language" options={LANGUAGE_OPTIONS} current={progress.nativeLanguage} searchable
        onSave={(v) => save({ nativeLanguage: v })} onClose={() => setOpen(null)} />}
      {open === "target" && <Picker title="Choose target language" options={LANGUAGE_OPTIONS} current={progress.language} searchable
        onSave={(v) => save({ language: v })} onClose={() => setOpen(null)} />}
      {open === "level" && <Picker title="Change your target language level" options={LEVEL_OPTIONS} current={progress.level}
        onSave={(v) => save({ level: v })} onClose={() => setOpen(null)} />}
    </>
  );
}
