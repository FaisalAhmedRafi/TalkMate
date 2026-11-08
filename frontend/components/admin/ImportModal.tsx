"use client";

import { useRef, useState } from "react";
import { FileJson, Loader2 } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { admin, FORMS, TEMPLATES, type ImportResult, type ModeInfo } from "@/lib/admin";

export function ImportModal({ info, onClose, onDone }: {
  info: ModeInfo; onClose: () => void; onDone: (r: ImportResult) => void;
}) {
  const mode = info.mode as keyof typeof TEMPLATES;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function readFile(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setErr(null);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { setErr("That is not valid JSON. Check commas and quotes."); return; }
    const items = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.items) ? (parsed as any).items : null;
    if (!items?.length) { setErr("Paste a list like [ { ... }, { ... } ]."); return; }
    setBusy(true);
    try {
      const r = await admin.import(info.mode, items);
      setResult(r); onDone(r);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const fieldNames = FORMS[info.mode].filter((f) => f.kind !== "image" && f.kind !== "portrait").map((f) => f.key + (f.optional ? "?" : "")).concat(info.mode === "sentence" || info.mode === "word" ? ["unitTitle? (new unit only)"] : []);

  return (
    <Modal onClose={onClose} label={`Import ${info.label} elements`} wide>
      <h2 className="pr-6 text-lg font-semibold">Import into {info.label} mode</h2>
      <p className="mt-1 text-xs text-white/50">Paste a JSON list or choose a .json file. Each item is checked on its own: bad ones are skipped and listed, good ones are saved.</p>
      <p className="mt-2 text-[11px] text-white/40">Fields: <span className="font-mono text-white/60">{fieldNames.join(", ")}</span></p>

      {!result ? (
        <>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
            placeholder={JSON.stringify(TEMPLATES[mode].slice(0, 1), null, 2)}
            className="mt-4 h-56 w-full resize-y rounded-lg border border-white/10 bg-[#16161c] p-3 font-mono text-xs outline-none placeholder:text-white/25 focus:ring-2 focus:ring-violet-500"
          />
          <ErrorText text={err} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"><FileJson size={15} /> Choose file</button>
            <button onClick={() => setText(JSON.stringify(TEMPLATES[mode], null, 2))} className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5">Insert example</button>
            <button onClick={submit} disabled={busy || !text.trim()}
              className="ml-auto flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" />} Import
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5">
          <p className="text-sm"><span className="font-semibold text-emerald-400">{result.created} added</span>{result.failed > 0 && <>, <span className="font-semibold text-amber-300">{result.failed} skipped</span></>}.</p>
          {result.failed > 0 && (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg bg-[#16161c] p-3 text-xs">
              {result.results.filter((r) => !r.ok).map((r) => (
                <li key={r.index} className="text-white/70"><span className="font-mono text-amber-300">#{r.index + 1}</span> {r.error}</li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex justify-end gap-2">
            {result.failed > 0 && <button onClick={() => setResult(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">Fix and retry</button>}
            <button onClick={onClose} className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold hover:bg-violet-500">Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
