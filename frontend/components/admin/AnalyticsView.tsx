"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock, Crown, Globe2, Loader2, MailCheck, RefreshCw, Share2, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";
import { admin, type AnalyticsData } from "@/lib/admin";
import { countryByCode } from "@/lib/countries";
import { Flag } from "@/components/CountryPicker";

type Range = "today" | "last7" | "last30" | "total";
const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7", label: "7 days" },
  { id: "last30", label: "30 days" },
  { id: "total", label: "All time" },
];

const nf = (n: number) => n.toLocaleString("en-US");
const countryName = (code: string) => (code === "??" ? "Not provided" : countryByCode(code)?.name ?? code);

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function Card({ icon, label, value, sub, tone = "violet" }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; tone?: "violet" | "emerald" | "amber" | "sky" }) {
  const tones = { violet: "bg-violet-600/20 text-violet-300", emerald: "bg-emerald-500/20 text-emerald-300", amber: "bg-amber-500/20 text-amber-300", sky: "bg-sky-500/20 text-sky-300" };
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#171827] p-4">
      <div className="flex items-center gap-2 text-xs text-white/55">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span>{label}
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/45">{sub}</p>}
    </div>
  );
}

function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-[#171827] p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Daily sign-ups of the last 30 days as bars (plain CSS, no chart library). */
function SignupChart({ series }: { series: AnalyticsData["series"] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px]" role="img" aria-label="Sign-ups per day, last 30 days">
        {series.map((s, i) => {
          const last = i === series.length - 1;
          return (
            <div key={s.date} className="group relative flex h-full flex-1 items-end" title={`${s.date}: ${s.count} sign-up${s.count === 1 ? "" : "s"}`}>
              <div className={`w-full rounded-t ${last ? "bg-violet-400" : "bg-violet-600/60 group-hover:bg-violet-500"}`} style={{ height: `${Math.max(s.count ? 4 : 1.5, (s.count / max) * 100)}%` }} />
              <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-black group-hover:block">{s.count}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/40">
        <span>{series[0]?.date.slice(5)}</span><span>peak {max}/day</span><span>Today</span>
      </div>
    </div>
  );
}

function Bars({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="py-4 text-sm text-white/45">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between"><span className="truncate">{r.label}</span><span className="tabular-nums text-white/55">{nf(r.count)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(r.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<Range>("today");

  const load = useCallback(() => {
    setBusy(true); setError(null);
    admin.analytics().then(setData).catch((e) => setError(e.message)).finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // keeps "today" fresh while the tab stays open
    return () => clearInterval(t);
  }, [load]);

  const ranked = useMemo(() => {
    if (!data) return [];
    return data.countries.map((c) => ({ ...c, n: c[range] })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  }, [data, range]);

  if (!data) {
    return error
      ? <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>
      : <p className="mt-6 flex items-center gap-2 text-sm text-white/50"><Loader2 size={15} className="animate-spin" /> Loading analytics…</p>;
  }

  const t = data.totals;
  const diff = t.signupsToday - t.signupsYesterday;
  const rangeTotal = ranked.reduce((a, c) => a + c.n, 0);
  const topN = ranked.slice(0, 10);

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/45">Day boundaries use your local time · updated {ago(data.generatedAt)}</p>
        <button onClick={load} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50">
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={<UserPlus size={15} />} label="Sign-ups today" value={nf(t.signupsToday)} tone="emerald"
          sub={<span className="inline-flex items-center gap-1">{diff >= 0 ? <TrendingUp size={12} className="text-emerald-300" /> : <TrendingDown size={12} className="text-red-300" />}{diff >= 0 ? "+" : ""}{diff} vs yesterday ({t.signupsYesterday})</span>} />
        <Card icon={<Users size={15} />} label="Sign-ups, last 7 days" value={nf(t.signups7)} sub={`${nf(t.signups30)} in 30 days · ${t.avgPerDay30}/day`} />
        <Card icon={<Users size={15} />} label="Total users" value={nf(t.users)} sub={`${t.countriesCount} countries`} tone="sky" />
        <Card icon={<Activity size={15} />} label="Active today" value={nf(t.activeToday)} sub={`${nf(t.active7)} active in 7 days`} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Sign-ups per day (30 days)" className="lg:col-span-3"><SignupChart series={data.series} /></Panel>
        <Panel title="Sign-ups by country" className="lg:col-span-2"
          right={
            <div className="flex rounded-lg bg-white/[0.06] p-0.5 text-[11px]">
              {RANGES.map((r) => (
                <button key={r.id} onClick={() => setRange(r.id)} aria-pressed={range === r.id}
                  className={`rounded-md px-2 py-1 ${range === r.id ? "bg-violet-600 text-white" : "text-white/55 hover:text-white"}`}>{r.label}</button>
              ))}
            </div>
          }>
          {topN.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-white/45"><Globe2 size={16} /> No sign-ups in this period yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {topN.map((c) => (
                <li key={c.code} className="text-sm">
                  <div className="flex items-center gap-2">
                    {c.code === "??" ? <Globe2 size={15} className="text-white/40" /> : <Flag code={c.code} className="h-3.5 w-5" />}
                    <span className="min-w-0 flex-1 truncate">{countryName(c.code)}</span>
                    <span className="tabular-nums text-white/55">{nf(c.n)} <span className="text-white/30">· {Math.round((c.n / rangeTotal) * 100)}%</span></span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(c.n / topN[0].n) * 100}%` }} /></div>
                </li>
              ))}
              {ranked.length > topN.length && <li className="text-xs text-white/40">+ {ranked.length - topN.length} more countries</li>}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={<Crown size={15} />} label="Premium users" value={nf(t.premium)} sub={`${nf(t.activeSubscriptions)} active subscriptions`} tone="amber" />
        <Card icon={<Share2 size={15} />} label="Joined by referral" value={nf(t.referred)} sub={t.users ? `${Math.round((t.referred / t.users) * 100)}% of users` : undefined} />
        <Card icon={<MailCheck size={15} />} label="Email verified" value={`${t.verifiedPct}%`} sub={`${nf(t.verified)} of ${nf(t.users)} · Google ${t.googlePct}%`} tone="emerald" />
        <Card icon={<Clock size={15} />} label="Practice time today" value={`${nf(t.practiceMinutesToday)} min`} sub="all learners together" tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Language being learned"><Bars rows={data.languages.slice(0, 8)} empty="No data yet." /></Panel>
        <Panel title="Learner level"><Bars rows={data.levels} empty="No data yet." /></Panel>
        <Panel title="Latest sign-ups">
          {data.recent.length === 0 ? <p className="py-4 text-sm text-white/45">Nobody has signed up yet.</p> : (
            <ul className="divide-y divide-white/[0.05]">
              {data.recent.slice(0, 8).map((u) => (
                <li key={u.id} className="flex items-center gap-2.5 py-2 text-sm">
                  {u.country ? <Flag code={u.country} className="h-3.5 w-5" /> : <Globe2 size={15} className="shrink-0 text-white/35" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-white/40">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-white/45">
                    <p>{ago(u.createdAt)}</p>
                    <p>{u.method}{!u.verified && " · unverified"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {t.noCountry > 0 && (
        <p className="text-xs text-white/40">{nf(t.noCountry)} users have no country saved (Google sign-ups that skipped it, and accounts made before the Country field existed); they appear as &quot;Not provided&quot;.</p>
      )}
    </div>
  );
}
