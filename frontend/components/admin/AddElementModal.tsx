"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { admin, fileToDataUrl, FORMS, type Field, type ModeInfo, type Overview } from "@/lib/admin";

type Values = Record<string, any>;
type Picked = { name: string; dataUrl: string };

const input = "w-full rounded-lg border border-white/10 bg-[#16161c] px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-violet-500";

function Label({ f, children }: { f: Field; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-2 text-xs font-medium text-white/80">
        {f.label}{f.optional && <span className="font-normal text-white/40">optional</span>}
      </span>
      {children}
      {f.hint && <span className="mt-1 block text-[11px] text-white/40">{f.hint}</span>}
    </label>
  );
}

export function AddElementModal({ info, overview, onChanged, onClose, onToast }: {
  info: ModeInfo; overview: Overview; onClose: () => void; onToast: (m: string) => void;
  /** called after each saved element with the new counts, so the table behind can refresh */
  onChanged: (u: { total: number; custom: number; units: ModeInfo["units"] }) => void;
}) {
  const fields = FORMS[info.mode];
  const units = info.units ?? [];
  const nextUnit = (units.length ? Math.max(...units.map((u) => u.number)) : 0) + 1;
  const [values, setValues] = useState<Values>({ unit: units.length ? units[units.length - 1].number : 1, hue: 210, tasks: ["", "", ""] });
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);

  const set = (key: string, v: unknown) => setValues((x) => ({ ...x, [key]: v }));
  const isNewUnit = fields.some((f) => f.kind === "unit") && !units.some((u) => u.number === Number(values.unit));
  const needsUnitTitle = isNewUnit && (info.mode === "sentence" || info.mode === "word");

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    try {
      const list = await Promise.all(Array.from(files).map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) })));
      setPicked((p) => [...p, ...list]);
    } catch (e) { setErr((e as Error).message); }
    if (fileRef.current) fileRef.current.value = "";
  }

  function missing(): string | null {
    for (const f of fields) {
      if (f.optional) continue;
      if (f.kind === "image") { if (!picked.length) return "Add at least one picture."; continue; }
      if (f.kind === "tasks") { if ((values.tasks as string[]).some((t) => !t.trim())) return "Fill in all three tasks."; continue; }
      if (f.kind === "unit" || f.kind === "hue") continue;
      if (!String(values[f.key] ?? "").trim()) return `${f.label} is required.`;
    }
    if (needsUnitTitle && !String(values.unitTitle ?? "").trim()) return "Give the new unit a title.";
    return null;
  }

  async function submit(another: boolean) {
    const m = missing();
    if (m) { setErr(m); return; }
    setBusy(true); setErr(null);
    let saved = 0;
    try {
      if (info.mode === "photo") {
        for (let i = 0; i < picked.length; i++) {
          setProgress(`Uploading ${i + 1} of ${picked.length}…`);
          const r = await admin.create("photo", { unit: Number(values.unit), image: picked[i].dataUrl });
          onChanged(r); saved++;
        }
        setPicked([]);
      } else {
        const item: Values = { ...values, unit: Number(values.unit) };
        if (!needsUnitTitle) delete item.unitTitle;
        const r = await admin.create(info.mode, item);
        onChanged(r); saved++;
      }
      onToast(saved === 1 ? "Added." : `Added ${saved} pictures.`);
      if (another) {
        // keep the grouping fields, clear the rest
        setValues((v) => ({ unit: v.unit, category: v.category, kind: v.kind, hue: v.hue ?? 210, tasks: ["", "", ""] }));
        (firstRef.current?.querySelector("input,textarea") as HTMLElement | null)?.focus();
      } else onClose();
    } catch (e) {
      setErr(saved ? `Saved ${saved}, then: ${(e as Error).message}` : (e as Error).message);
    } finally { setBusy(false); setProgress(null); }
  }

  const options = (f: Field) => (f.options === "categories" ? overview.roleplayCategories : overview.characterKinds);

  return (
    <Modal onClose={onClose} label={`Add ${info.label} element`} wide>
      <h2 className="pr-6 text-lg font-semibold">Add to {info.label} mode</h2>
      <p className="mt-1 text-xs text-white/50">It shows up for every learner as soon as you save.</p>

      <div ref={firstRef} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const wide = f.kind === "textarea" || f.kind === "tasks" || f.kind === "image" || f.key === "title" || f.key === "name" || f.key === "english";
          return (
            <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
              {f.kind === "unit" && (
                <>
                  <Label f={f}>
                    <select className={input} value={String(values.unit)} onChange={(e) => set("unit", Number(e.target.value))}>
                      {units.map((u) => <option key={u.number} value={u.number}>{info.mode === "photo" ? `Unit ${u.number}` : `Unit ${u.number} · ${u.title}`}</option>)}
                      <option value={nextUnit}>+ New unit ({nextUnit})</option>
                    </select>
                  </Label>
                  {needsUnitTitle && (
                    <input className={`${input} mt-2`} placeholder={`Title of unit ${nextUnit}`} value={values.unitTitle ?? ""} maxLength={60} onChange={(e) => set("unitTitle", e.target.value)} />
                  )}
                </>
              )}
              {(f.kind === "text") && <Label f={f}><input className={input} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} /></Label>}
              {f.kind === "emoji" && <Label f={f}><input className={`${input} text-lg`} value={values[f.key] ?? ""} placeholder={f.placeholder} maxLength={16} onChange={(e) => set(f.key, e.target.value)} /></Label>}
              {f.kind === "textarea" && <Label f={f}><textarea className={`${input} min-h-[72px] resize-y`} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} /></Label>}
              {f.kind === "select" && (
                <Label f={f}>
                  <select className={input} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="" disabled>Choose…</option>
                    {options(f).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Label>
              )}
              {f.kind === "hue" && (
                <Label f={f}>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={360} value={values.hue} onChange={(e) => set("hue", Number(e.target.value))} className="flex-1" />
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg" style={{ background: `linear-gradient(135deg, hsl(${values.hue} 70% 45%), hsl(${(values.hue + 40) % 360} 70% 30%))` }}>{values.emoji || "🙂"}</span>
                  </div>
                </Label>
              )}
              {f.kind === "tasks" && (
                <Label f={f}>
                  <div className="space-y-2">
                    {(values.tasks as string[]).map((t, i) => (
                      <input key={i} className={input} placeholder={`Task ${i + 1}`} value={t} maxLength={140}
                        onChange={(e) => set("tasks", (values.tasks as string[]).map((x, j) => (j === i ? e.target.value : x)))} />
                    ))}
                  </div>
                </Label>
              )}
              {f.kind === "image" && (
                <Label f={f}>
                  <div className="rounded-xl border border-dashed border-white/15 p-3">
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm text-white/70 hover:bg-white/5">
                      <ImagePlus size={18} /> Choose pictures (PNG, JPEG, WebP)
                    </button>
                    {picked.length > 0 && (
                      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {picked.map((p, i) => (
                          <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.dataUrl} alt={p.name} className="aspect-square w-full rounded-lg object-cover" />
                            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPicked((l) => l.filter((_, j) => j !== i))}
                              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white/80 hover:text-white"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Label>
              )}
            </div>
          );
        })}
      </div>

      <ErrorText text={err} />

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {progress && <span className="mr-auto text-xs text-white/50">{progress}</span>}
        <button onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-50">Cancel</button>
        {info.mode !== "photo" && (
          <button onClick={() => submit(true)} disabled={busy} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50">Add and next</button>
        )}
        <button onClick={() => submit(false)} disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" />} Add
        </button>
      </div>
    </Modal>
  );
}
