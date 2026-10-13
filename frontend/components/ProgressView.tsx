"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Award, CalendarDays, Check, ChevronDown, Clock, Flame, Info,
  MessageCircle, Rocket, Share2, Star, Timer, Trophy, type LucideIcon,
} from "lucide-react";
import { Modal } from "./Modal";
import { api, type Progress, type Stats } from "@/lib/api";
import { addDays, localDay, parseDay, shortDate, startOfWeek, ymd } from "@/lib/dates";

const XP_PER_LEVEL = 50; // keep in sync with the dashboard
const STUDY_SECONDS = 180; // keep in sync with the backend

const fmtTime = (seconds: number) => {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} ${m === 1 ? "minute" : "minutes"}`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const Card = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/5 bg-[#1f1f27] p-7">{children}</section>
);
const CardHead = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="border-b border-white/5 pb-5">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {right}
    </div>
    {sub && <p className="mt-2 text-[15px] text-white/70">{sub}</p>}
  </div>
);

const ICONS: Record<string, LucideIcon> = {
  first_step: Rocket, warm_up: Timer, on_a_roll: Flame, week: Trophy,
  chatterbox: MessageCircle, hour: Clock, level5: Star,
};
const HEX = { clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)" };

export function ProgressView({ s, onOpenFeedback }: { s: Progress; onOpenFeedback: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7" | "28" | "all">("7");
  const [calOpen, setCalOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    api.progress.stats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load stats"));
  }, [s.messages, s.streak]);

  const secondsByDay = useMemo(() => new Map((stats?.days ?? []).map((d) => [d.day, d.seconds])), [stats]);
  const today = new Date();

  const series = useMemo(() => {
    let start = addDays(today, range === "7" ? -6 : range === "28" ? -27 : -6);
    if (range === "all" && stats?.days[0]) {
      const first = parseDay(stats.days[0].day);
      if (first < start) start = first;
    }
    const out: { day: string; min: number }[] = [];
    for (let d = start; ymd(d) <= ymd(today); d = addDays(d, 1)) {
      out.push({ day: ymd(d), min: (secondsByDay.get(ymd(d)) ?? 0) / 60 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, stats, secondsByDay]);

  const level = Math.floor(s.xp / XP_PER_LEVEL) + 1;
  const xpLeft = XP_PER_LEVEL - (s.xp % XP_PER_LEVEL);
  const levelPct = ((s.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;

  const weeks = calOpen ? 5 : 1;
  const firstMonday = addDays(startOfWeek(today), -7 * (weeks - 1));
  const todayKey = localDay();

  const share = async () => {
    const text = `I'm level ${level} on TalkMate!`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch {}
  };

  const unlocked = stats?.achievements.filter((a) => a.unlocked) ?? [];
  const rangeLabel = range === "all"
    ? "All time"
    : `Last ${range} days: ${shortDate(parseDay(series[0]?.day ?? todayKey))} - ${shortDate(today)}`;

  return (
    <div className="mx-auto max-w-[1070px] pt-2">
      <h1 className="text-lg font-semibold">Progress</h1>
      <p className="mt-4 border-b border-white/5 pb-6 text-white/80">View your learning progress and statistics.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <button onClick={onOpenFeedback}
            className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-300 px-7 py-7 text-left text-zinc-900">
            <span>
              <span className="block text-2xl font-semibold">Daily Feedback</span>
              <span className="mt-2 block text-[15px]">See your daily practice feedbacks here.</span>
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-yellow-500"><ArrowRight size={20} /></span>
          </button>

          <Card>
            <CardHead title="Stats" sub="Your personal learning data." />
            <ul className="mt-2 divide-y divide-white/5">
              {[
                { icon: Timer, big: stats ? fmtTime(stats.totalSeconds) : "…", small: "Total learning time." },
                { icon: Clock, big: stats ? fmtTime(stats.activeDays ? Math.round(stats.totalSeconds / stats.activeDays) : 0) : "…", small: "Average practice time." },
                { icon: CalendarDays, big: stats ? `${plural(stats.studiedDays, "day")} studied` : "…", small: "Number of practice sessions completed." },
              ].map(({ icon: Icon, big, small }) => (
                <li key={small} className="flex items-center gap-4 py-5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5"><Icon size={22} /></span>
                  <span><span className="block text-xl font-semibold">{big}</span><span className="text-[15px] text-white/70">{small}</span></span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHead title="Current streak" sub="Practice at least 3 minutes a day to complete a session." />
            <div className="flex items-center justify-between py-6">
              <span className="text-xl font-semibold">Ongoing streak</span>
              <span className="rounded-full bg-indigo-700 px-4 py-3 text-sm font-semibold">{plural(s.streak, "day")}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-6">
              <span className="text-xl font-semibold">Longest streak</span>
              <span className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold">{plural(s.longest, "day")}</span>
            </div>
          </Card>

          <Card>
            <CardHead title="Streak calendar" right={
              <button onClick={() => setCalOpen((o) => !o)} aria-expanded={calOpen} aria-label="Show more weeks"
                className="flex items-center gap-3 rounded-full">
                <span className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-2 text-sm text-white/60">
                  <Flame size={16} className="text-sky-400" />{s.streak}
                </span>
                <ChevronDown size={20} className={`transition-transform ${calOpen ? "rotate-180" : ""}`} />
              </button>
            } />
            <div className="mt-6 grid grid-cols-7 gap-y-3 text-center">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="text-lg font-semibold">{d}</span>)}
              {Array.from({ length: weeks * 7 }, (_, i) => {
                const d = addDays(firstMonday, i);
                const key = ymd(d);
                const secs = secondsByDay.get(key) ?? 0;
                const studied = secs >= STUDY_SECONDS;
                return (
                  <span key={key} title={secs ? fmtTime(secs) : "No practice"}
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold ${
                      studied ? "bg-indigo-600" : ""} ${key === todayKey ? "ring-2 ring-white/60" : ""} ${key > todayKey ? "text-white/40" : ""}`}>
                    {studied ? <Check size={18} /> : d.getDate()}
                  </span>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHead title="Overall practice time" sub="Aggregated amount of your practice time." />
            <div className="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Time range">
              {([["7", "7 days"], ["28", "28 days"], ["all", "All time"]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
                  className={`rounded-full py-2 text-xs font-semibold ${range === k ? "bg-indigo-600" : "bg-white/5 hover:bg-white/10"}`}>{label}</button>
              ))}
            </div>
            <AreaChart values={series.map((p) => p.min)} labels={series.map((p) => `${shortDate(parseDay(p.day))}: ${fmtTime(Math.round(p.min * 60))}`)} />
            <p className="border-t border-white/5 pt-4 text-xs text-white/70">{rangeLabel}</p>
          </Card>

          <section className="rounded-2xl bg-indigo-700 p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <h2 className="text-2xl font-semibold">Level {level}</h2>
                <p className="mt-2 text-[15px] text-white/70">Your current level.</p>
              </div>
              <button onClick={share} aria-label="Share your level" title={shared ? "Copied" : "Share"} className="self-start text-white/90 hover:text-white">
                {shared ? <Check size={20} /> : <Share2 size={20} />}
              </button>
            </div>
            <p className="mt-5 text-xl font-semibold">XP left till the next level: {xpLeft} XP</p>
            <p className="mt-3 border-b border-white/10 pb-5 text-[15px] text-white/70">Keep on learning!</p>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-indigo-700">
              <span className="text-xl font-semibold">{level}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-indigo-200">
                <div className="h-full rounded-full bg-indigo-700 transition-all" style={{ width: `${levelPct}%` }} />
              </div>
              <span className="text-xl font-semibold text-indigo-300">{level + 1}</span>
            </div>
          </section>

          <Card>
            <CardHead title="Certificates" sub="Complete courses or reach practice goals to earn certificates."
              right={<span title="Certificates arrive with Courses, which are not built yet"><Info size={20} /></span>} />
            <div className="flex flex-col items-center py-8 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-400/30"><Award size={44} className="text-indigo-300" /></span>
              <p className="mt-5 font-semibold">No certificates yet</p>
              <p className="mt-1 text-sm text-white/70">Your certificates will appear here.</p>
            </div>
          </Card>

          <Card>
            <CardHead title="Achievements" sub="Complete achievement tasks to unlock badges." />
            <p className="mt-5 font-semibold">Your achievements</p>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }, (_, i) => {
                const a = unlocked[i];
                const Icon = a ? ICONS[a.id] ?? Star : null;
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <span style={HEX} className={`flex h-24 w-full items-center justify-center ${a ? "bg-amber-400 text-white" : "bg-white/5"}`}>
                      {Icon && <Icon size={32} />}
                    </span>
                    {a && <span className="text-center text-sm font-semibold">{a.name}</span>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setAllOpen(true)} className="mt-6 w-full rounded-xl bg-white/10 py-4 font-semibold hover:bg-white/20">See all</button>
          </Card>
        </div>
      </div>

      {allOpen && (
        <Modal onClose={() => setAllOpen(false)} label="All achievements">
          <h2 className="text-xl font-semibold">Achievements</h2>
          <ul className="mt-4 space-y-3">
            {(stats?.achievements ?? []).map((a) => {
              const Icon = ICONS[a.id] ?? Star;
              return (
                <li key={a.id} className={`flex items-center gap-4 ${a.unlocked ? "" : "opacity-50"}`}>
                  <span style={HEX} className={`flex h-14 w-14 shrink-0 items-center justify-center ${a.unlocked ? "bg-amber-400 text-white" : "bg-white/10"}`}><Icon size={22} /></span>
                  <span><span className="block font-semibold">{a.name}</span><span className="text-sm text-white/70">{a.description}</span></span>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function AreaChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 460, H = 190, pad = 8;
  const max = Math.max(...values, 1);
  const n = values.length;
  const pts = values.map((v, i) => [n === 1 ? W / 2 : (i / (n - 1)) * W, H - pad - (v / max) * (H - 2 * pad)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const empty = values.every((v) => v === 0);
  return (
    <div className="relative my-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Practice minutes per day">
        <defs>
          <linearGradient id="practiceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b3fd8" /><stop offset="1" stopColor="#3b3fd8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#practiceFill)" />
        <path d={line} fill="none" stroke="#4f52f0" strokeWidth="2" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={6} fill="transparent"><title>{labels[i]}</title></circle>
        ))}
      </svg>
      {empty && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-white/60">No practice in this period yet</p>}
    </div>
  );
}
