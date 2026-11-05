"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, SearchX, Trash2 } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { LANGUAGE_OPTIONS, LEVEL_OPTIONS, Picker, PickerField } from "@/components/account/SettingsView";
import { api, type ChatHistoryItem, type Progress } from "@/lib/api";
import { SPEEDS, TUTORS, type ChatPrefs } from "@/lib/chat";

const BLUE = "bg-[#2f39c8] hover:bg-[#3a45d8]";

/** "Pick your personal AI tutor": a card per tutor and a Save button. */
export function TutorPicker({ current, onSave, onClose, hint = "Your personal AI tutor will appear in the chat mode." }: {
  current: string; onSave: (id: string) => void; onClose: () => void; hint?: string;
}) {
  const [picked, setPicked] = useState(current);
  return (
    <Modal onClose={onClose} label="Pick your personal AI tutor" wide>
      <h2 className="px-8 pt-4 text-center text-xl font-semibold">Pick your personal AI tutor</h2>
      <p className="mt-4 text-center text-sm text-white/80">{hint}</p>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {TUTORS.map((t) => (
          <li key={t.id}>
            <button onClick={() => setPicked(t.id)} aria-pressed={picked === t.id} className="block w-full text-center">
              <span className={`block rounded-2xl border p-2 transition-colors ${picked === t.id ? "border-white" : "border-white/10 hover:border-white/30"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.img} alt="" className="aspect-square w-full rounded-xl object-cover" />
              </span>
              <span className="mt-4 block text-sm font-semibold">{t.id}</span>
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => onSave(picked)} className={`mt-8 w-full rounded-2xl py-4 text-sm font-semibold text-white ${BLUE}`}>Save</button>
    </Modal>
  );
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "Chat history": the archived chats, or an empty state with a "Start a new chat" button. */
export function HistoryModal({ onOpen, onNew, onClose }: { onOpen: (id: string) => void; onNew: () => void; onClose: () => void }) {
  const [chats, setChats] = useState<ChatHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.chat.history().then((r) => setChats(r.chats)).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your chats"));
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    try { await api.chat.remove(id); setChats((c) => c?.filter((x) => x.id !== id) ?? c); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete this chat"); }
  };

  return (
    <Modal onClose={onClose} label="Chat history">
      <h2 className="text-lg font-semibold">Chat history</h2>
      <ErrorText text={error} />
      {!chats && !error && <div className="flex justify-center py-24 text-white/70"><Loader2 className="animate-spin" /></div>}
      {chats && chats.length === 0 && (
        <div className="flex min-h-[420px] flex-col">
          <div className="m-auto flex flex-col items-center text-center">
            <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white/10"><SearchX size={28} /></span>
            <p className="mt-6 text-sm font-semibold">Chat history empty</p>
            <p className="mt-3 max-w-[300px] text-xs text-white/75">You don&apos;t have any saved chats. Once you start a new chat, old ones will appear here.</p>
          </div>
          <button onClick={onNew} className="mt-8 w-full rounded-2xl bg-[#43455a] py-5 text-sm font-semibold hover:bg-[#4d5066]">Start a new chat</button>
        </div>
      )}
      {chats && chats.length > 0 && (
        <ul className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {chats.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-2xl border border-white/10 hover:border-white/30">
              <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 px-4 py-3 text-left">
                <span className="block truncate text-sm font-semibold">{c.title || "New chat"}</span>
                <span className="mt-1 block text-xs text-white/60">{c.tutor} · {c.count} {c.count === 1 ? "message" : "messages"} · {when(c.updatedAt)}</span>
              </button>
              <button onClick={() => remove(c.id)} aria-label="Delete this chat" className="mr-3 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** "Are you sure you want to start a new chat?" */
export function NewChatConfirm({ onYes, onCancel }: { onYes: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel} label="Start a new chat">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><AlertCircle size={22} /></span>
      <h2 className="mt-6 pr-4 text-2xl font-semibold leading-tight">Are you sure you want to start a new chat?</h2>
      <p className="mt-4 text-sm text-white/75">Your current conversation will be moved to your chat history.</p>
      <button onClick={onYes} className="mt-8 w-full rounded-2xl bg-[#43455a] py-5 text-sm font-semibold hover:bg-[#4d5066]">Yes</button>
      <button onClick={onCancel} className={`mt-3 w-full rounded-2xl py-5 text-sm font-semibold text-white ${BLUE}`}>Cancel</button>
    </Modal>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-5">
      <span className="text-sm font-semibold">{label}</span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className={`relative h-8 w-16 rounded-full transition-colors ${on ? "bg-[#2f39c8]" : "bg-white/15"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-9" : "left-1"}`} />
      </button>
    </div>
  );
}

type Patch = { language?: string; nativeLanguage?: string; level?: string };
type Field = "native" | "target" | "level";

/** Chat "Settings": the language pickers, the two toggles and the voice speed. */
export function ChatSettings({ progress, prefs, onPrefs, onSettings, onClose }: {
  progress: Progress; prefs: ChatPrefs; onPrefs: (patch: Partial<ChatPrefs>) => void;
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
            <p className="mb-3 text-sm font-semibold">Suggestion bar</p>
            <Toggle label="Show bar" on={prefs.suggestions} onChange={(v) => onPrefs({ suggestions: v })} />
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Auto microphone activation</p>
            <Toggle label="Activate automatically" on={prefs.autoMic} onChange={(v) => onPrefs({ autoMic: v })} />
          </div>
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
