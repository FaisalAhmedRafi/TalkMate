"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileJson, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { admin, type AdminMode, type Counts, type ImportResult, type Overview, type Row } from "@/lib/admin";
import { AddElementModal } from "./AddElementModal";
import { ImportModal } from "./ImportModal";

const PAGE = 100;
const COVERS_PER_REQUEST = 20;

/**
 * The picture of a row. The emoji stands in until the picture is known (and stays when there is none). The picture is only
 * asked for once the row scrolls into view, so opening a long list does not look up every picture at once.
 */
function Thumb({ row, cover, onVisible }: { row: Row; cover: string | null | undefined; onVisible: (id: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);
  const known = !!row.image || cover !== undefined;
  useEffect(() => {
    const el = ref.current;
    if (known || !el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { onVisible(row.id); io.disconnect(); }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [known, row.id, onVisible]);
  const src = failed ? null : row.image ?? cover;
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-8 w-8 shrink-0 rounded-md object-cover" />;
  return <span ref={ref} className="grid h-8 w-8 shrink-0 place-items-center text-lg leading-none">{row.emoji}</span>;
}

export function AdminPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [mode, setMode] = useState<AdminMode>("sentence");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [customOnly, setCustomOnly] = useState(false);
  const [changedOnly, setChangedOnly] = useState(false); // built-in elements an admin edited or deleted
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // pictures for the rows (id -> url, null = none): asked for in small batches as rows scroll into view
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const modeRef = useRef(mode); modeRef.current = mode;
  const gen = useRef(0); // bumped whenever the list reloads, so a late answer for the old list is dropped
  const asked = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (pending.current.size) {
        const m = modeRef.current, g = gen.current;
        const ids = [...pending.current].slice(0, COVERS_PER_REQUEST);
        ids.forEach((i) => pending.current.delete(i));
        let got: Record<string, string | null>;
        try { got = (await admin.covers(m, ids)).covers; } catch { got = Object.fromEntries(ids.map((i) => [i, null])); }
        if (g === gen.current) setCovers((c) => ({ ...c, ...got }));
      }
    } finally { flushing.current = false; }
  }, []);
  const wantCover = useCallback((id: string) => {
    if (asked.current.has(id)) return;
    asked.current.add(id); pending.current.add(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 150);
  }, [flush]);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => { admin.overview().then(setOverview).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback((m: AdminMode) => {
    setRows(null); setError(null);
    gen.current++; asked.current.clear(); pending.current.clear(); setCovers({}); // search words may have changed: look the pictures up again
    admin.items(m).then((r) => setRows(r.rows)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(mode); setQ(""); setGroup(""); setCustomOnly(false); setChangedOnly(false); setShown(PAGE); }, [mode, load]);

  const info = overview?.modes.find((m) => m.mode === mode);
  const patchInfo = (u: Counts) =>
    setOverview((o) => o && { ...o, modes: o.modes.map((m) => (m.mode === mode ? { ...m, ...u } : m)) });

  const groups = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.group))).filter(Boolean), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (!group || r.group === group) && (!customOnly || r.custom) && (!changedOnly || !!r.status) &&
      (!needle || `${r.title} ${r.sub} ${r.id} ${r.group}`.toLowerCase().includes(needle)));
  }, [rows, q, group, customOnly, changedOnly]);
  useEffect(() => setShown(PAGE), [q, group, customOnly, changedOnly]);

  async function remove(r: Row) {
    const warn = r.custom
      ? "Learners lose access to it right away. Their saved progress on it is kept in the database but no longer counted."
      : "It is a built-in element: learners lose access to it right away, and you can bring it back any time with Restore. Their saved progress is kept.";
    const path = !r.custom && ["word", "sentence", "dialogue"].includes(mode) ? "\n\nIt is also hidden from the course Learn paths." : "";
    if (!window.confirm(`Delete "${r.title}" from ${info?.label} mode?\n\n${warn}${path}`)) return;
    try {
      const res = await admin.remove(mode, r.id);
      patchInfo(res); load(mode); setToast(r.custom ? "Deleted." : "Deleted. You can restore it from this table.");
    } catch (e) { setToast((e as Error).message); }
  }

  /** Reset an edited built-in element, or restore a deleted one: it is back exactly as the code defines it. */
  async function undo(r: Row) {
    if (r.status === "edited" && !window.confirm(`Reset "${r.title}" to the original built-in version?\n\nYour changes to it are discarded.`)) return;
    try {
      const res = await admin.restore(mode, r.id);
      patchInfo(res); load(mode); setToast(r.status === "deleted" ? "Restored." : "Reset to the original.");
    } catch (e) { setToast((e as Error).message); }
  }

  const onImported = (r: ImportResult) => { patchInfo(r); load(mode); if (r.created) setToast(`${r.created} added.`); };

  return (
    <div className="min-h-screen bg-[#0D0E17] text-white">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <header className="flex items-center gap-3">
          <Link href="/dashboard?tab=home" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"><ArrowLeft size={16} /> Back to app</Link>
          <h1 className="ml-1 text-lg font-semibold">Admin panel</h1>
          <span className="rounded-full bg-violet-600/20 px-2 py-0.5 text-[11px] font-medium text-violet-200">Learning content</span>
        </header>

        {/* mode tabs with counts */}
        <nav aria-label="Learning modes" className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(overview?.modes ?? []).map((m) => (
            <button key={m.mode} onClick={() => setMode(m.mode)} aria-current={m.mode === mode}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${m.mode === mode ? "border-violet-400/40 bg-violet-600/25 text-white" : "border-white/10 bg-[#171827] text-white/70 hover:bg-white/5"}`}>
              {m.label}
              <span className="text-xs tabular-nums text-white/50">{m.total}</span>
              {m.custom > 0 && <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-semibold text-emerald-300">+{m.custom}</span>}
              {m.changed > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-300">~{m.changed}</span>}
            </button>
          ))}
          {!overview && !error && <span className="flex items-center gap-2 py-1.5 text-sm text-white/50"><Loader2 size={14} className="animate-spin" /> Loading…</span>}
        </nav>

        {/* toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${info?.label ?? ""} elements`} aria-label="Search"
              className="w-full rounded-lg border border-white/10 bg-[#171827] py-2 pl-9 pr-3 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-violet-500" />
          </div>
          {groups.length > 1 && (
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter"
              className="max-w-[220px] rounded-lg border border-white/10 bg-[#171827] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">All groups</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70">
            <input type="checkbox" checked={customOnly} onChange={(e) => setCustomOnly(e.target.checked)} className="accent-violet-500" /> Added by admin
          </label>
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70">
            <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} className="accent-amber-500" /> Edited / deleted
          </label>
          <div className="ml-auto flex gap-2">
            {mode !== "photo" && (
              <button onClick={() => setImporting(true)} disabled={!info} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"><FileJson size={15} /> Import JSON</button>
            )}
            <button onClick={() => setAdding(true)} disabled={!info} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"><Plus size={16} /> Add {mode === "photo" ? "pictures" : "new"}</button>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

        {/* compact table */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171827]">
          {!rows && !error ? (
            <p className="flex items-center gap-2 p-6 text-sm text-white/50"><Loader2 size={15} className="animate-spin" /> Loading…</p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 text-xs text-white/50">
                <span>{filtered.length === (rows?.length ?? 0) ? `${filtered.length} elements` : `${filtered.length} of ${rows?.length} elements`}</span>
                <span className="hidden sm:inline">Every element can be edited or deleted. Built-in ones keep their original and can be reset or restored.</span>
              </div>
              {filtered.length === 0 ? (
                <p className="p-6 text-sm text-white/50">Nothing matches.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {filtered.slice(0, shown).map((r) => (
                    <li key={r.id} className={`group flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-white/[0.03] ${r.status === "deleted" ? "opacity-50" : ""}`}>
                      <Thumb row={r} cover={covers[r.id]} onVisible={wantCover} />
                      <span className={`w-[34%] min-w-0 shrink-0 truncate font-medium sm:w-[26%] ${r.status === "deleted" ? "line-through" : ""}`} title={r.title}>{r.title}</span>
                      <span className="hidden min-w-0 flex-1 truncate text-white/45 md:block" title={r.sub}>{r.sub}</span>
                      <span className="ml-auto max-w-[40%] shrink-0 truncate rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/60 md:ml-0 md:max-w-[200px]" title={r.group}>{r.group}</span>
                      {r.status === "deleted" ? (
                        <>
                          <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">Deleted</span>
                          <button onClick={() => undo(r)} aria-label={`Restore ${r.title}`} title="Restore" className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15"><Undo2 size={14} /> Restore</button>
                        </>
                      ) : (
                        <>
                          {r.custom ? (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Added</span>
                          ) : r.status === "edited" ? (
                            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Edited</span>
                          ) : (
                            <span className="hidden w-[78px] shrink-0 text-right text-[10px] uppercase tracking-wide text-white/30 sm:block">Built-in</span>
                          )}
                          <button onClick={() => setEditing(r)} aria-label={`Edit ${r.title}`} title="Edit" className="shrink-0 rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><Pencil size={15} /></button>
                          {r.status === "edited" && (
                            <button onClick={() => undo(r)} aria-label={`Reset ${r.title} to the original`} title="Reset to the original" className="shrink-0 rounded-md p-1.5 text-white/40 hover:bg-amber-500/15 hover:text-amber-300"><RotateCcw size={15} /></button>
                          )}
                          <button onClick={() => remove(r)} aria-label={`Delete ${r.title}`} title="Delete" className="shrink-0 rounded-md p-1.5 text-white/40 hover:bg-red-500/15 hover:text-red-300"><Trash2 size={15} /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {filtered.length > shown && (
                <button onClick={() => setShown((n) => n + PAGE)} className="w-full border-t border-white/[0.06] py-2.5 text-sm text-violet-300 hover:bg-white/[0.03]">
                  Show {Math.min(PAGE, filtered.length - shown)} more
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {adding && info && overview && <AddElementModal info={info} overview={overview} onClose={() => { setAdding(false); load(mode); }} onChanged={patchInfo} onToast={setToast} />}
      {editing && info && overview && <AddElementModal info={info} overview={overview} edit={editing} onClose={() => { setEditing(null); load(mode); }} onChanged={patchInfo} onToast={setToast} />}
      {importing && info && <ImportModal info={info} onClose={() => setImporting(false)} onDone={onImported} />}
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-lg">{toast}</div>}
    </div>
  );
}
