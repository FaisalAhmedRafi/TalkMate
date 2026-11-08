"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileJson, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { admin, type AdminMode, type ImportResult, type ModeInfo, type Overview, type Row } from "@/lib/admin";
import { AddElementModal } from "./AddElementModal";
import { ImportModal } from "./ImportModal";

const PAGE = 100;

export function AdminPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [mode, setMode] = useState<AdminMode>("sentence");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [customOnly, setCustomOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { admin.overview().then(setOverview).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback((m: AdminMode) => {
    setRows(null); setError(null);
    admin.items(m).then((r) => setRows(r.rows)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(mode); setQ(""); setGroup(""); setCustomOnly(false); setShown(PAGE); }, [mode, load]);

  const info = overview?.modes.find((m) => m.mode === mode);
  const patchInfo = (u: { total: number; custom: number; units: ModeInfo["units"] }) =>
    setOverview((o) => o && { ...o, modes: o.modes.map((m) => (m.mode === mode ? { ...m, ...u } : m)) });

  const groups = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.group))).filter(Boolean), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (!group || r.group === group) && (!customOnly || r.custom) &&
      (!needle || `${r.title} ${r.sub} ${r.id} ${r.group}`.toLowerCase().includes(needle)));
  }, [rows, q, group, customOnly]);
  useEffect(() => setShown(PAGE), [q, group, customOnly]);

  async function remove(r: Row) {
    if (!window.confirm(`Delete "${r.title}" from ${info?.label} mode?\n\nLearners lose access to it right away. Their saved progress on it is kept in the database but no longer counted.`)) return;
    try {
      const res = await admin.remove(mode, r.id);
      patchInfo(res); load(mode); setToast("Deleted.");
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
                <span className="hidden sm:inline">Built-in elements are read-only; the ones you add can be deleted.</span>
              </div>
              {filtered.length === 0 ? (
                <p className="p-6 text-sm text-white/50">Nothing matches.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {filtered.slice(0, shown).map((r) => (
                    <li key={r.id} className="group flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-white/[0.03]">
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center text-lg leading-none">{r.emoji}</span>
                      )}
                      <span className="w-[34%] min-w-0 shrink-0 truncate font-medium sm:w-[26%]" title={r.title}>{r.title}</span>
                      <span className="hidden min-w-0 flex-1 truncate text-white/45 md:block" title={r.sub}>{r.sub}</span>
                      <span className="ml-auto max-w-[40%] shrink-0 truncate rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/60 md:ml-0 md:max-w-[200px]" title={r.group}>{r.group}</span>
                      {r.custom ? (
                        <>
                          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Added</span>
                          <button onClick={() => remove(r)} aria-label={`Delete ${r.title}`} className="shrink-0 rounded-md p-1.5 text-white/40 hover:bg-red-500/15 hover:text-red-300"><Trash2 size={15} /></button>
                        </>
                      ) : (
                        <span className="hidden w-[78px] shrink-0 text-right text-[10px] uppercase tracking-wide text-white/30 sm:block">Built-in</span>
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
      {importing && info && <ImportModal info={info} onClose={() => setImporting(false)} onDone={onImported} />}
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-lg">{toast}</div>}
    </div>
  );
}
