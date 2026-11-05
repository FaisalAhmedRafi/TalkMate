"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, GraduationCap, BookOpen, Library, Star, TrendingUp, Gift, User, Lock, ArrowRight, Sparkle,
} from "lucide-react";
import { Modal, ErrorText } from "@/components/Modal";
import { GeneratePanel } from "@/components/GeneratePanel";
import { PhotoPanel } from "@/components/PhotoPanel";
import { PracticeTimer } from "@/components/PracticeTimer";
import { ProgressView } from "@/components/ProgressView";
import { CoursesView } from "@/components/CoursesView";
import { LearnView } from "@/components/LearnView";
import { ExploreView } from "@/components/ExploreView";
import { courseById, loadCourseId, saveCourseId, type Course } from "@/lib/courses";
import { AccountView } from "@/components/account/AccountView";
import { api, clearToken, getToken, type Progress } from "@/lib/api";
import { MODES, type Mode } from "@/lib/modes";

const NAV = [
  { id: "home", label: "Home", icon: LayoutGrid, dot: false },
  { id: "learn", label: "Learn", icon: BookOpen, dot: false },
  { id: "courses", label: "Courses", icon: GraduationCap, dot: false },
  { id: "explore", label: "Explore", icon: Library, dot: false },
  { id: "progress", label: "Progress", icon: TrendingUp, dot: true },
];
const TABS = ["learn", "courses", "explore", "progress"]; // sections that can be opened with /dashboard?tab=...

const XP_PER_LEVEL = 50;
// level tiers shown on the Level card (the medal colour and name change as the level grows)
const TIERS = [
  { min: 1, name: "Starter", ring: "from-zinc-300 to-zinc-600" },
  { min: 3, name: "Bronze", ring: "from-orange-300 to-orange-700" },
  { min: 6, name: "Silver", ring: "from-slate-200 to-slate-500" },
  { min: 10, name: "Gold", ring: "from-yellow-200 to-yellow-600" },
  { min: 15, name: "Platinum", ring: "from-cyan-200 to-sky-500" },
];
const EMPTY: Progress = {
  email: "", xp: 0, streak: 0, longest: 0, messages: 0, premium: false, giftClaimed: false,
  language: "Spanish", nativeLanguage: "English", level: "Beginner", today: [],
};

export default function Dashboard() {
  const router = useRouter();
  const [active, setActive] = useState("home");
  const [s, setS] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<Mode | null>(null);
  const [upsell, setUpsell] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [courseId, setCourseId] = useState(() => courseById(loadCourseId()).id); // the course shown on Learn

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        setS(p); setLoaded(true);
        // other pages link here with ?tab=learn / ?tab=progress
        const tab = new URLSearchParams(window.location.search).get("tab");
        if (tab && TABS.includes(tab)) setActive(tab);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load your progress"));
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const fail = (e: unknown) => setToast(e instanceof Error ? e.message : "Something went wrong");
  const practice = (text: string) => { api.progress.practice(text).then(setS).catch(fail); };
  const updateSettings = (patch: { language?: string; nativeLanguage?: string; level?: string }) => {
    setS((p) => ({ ...p, ...patch }));
    api.progress.settings(patch).catch(fail);
  };
  const unlockPremium = () =>
    api.progress.premium()
      .then((p) => { setS(p); setUpsell(null); setToast("Premium unlocked (demo)"); })
      .catch(fail);
  const claimGift = () => {
    if (s.giftClaimed) return setToast("Gift already claimed");
    api.progress.gift().then((p) => { setS(p); setToast("Gift claimed: +20 XP"); }).catch(fail);
  };
  const logout = () => { clearToken(); router.replace("/login"); };

  const level = Math.floor(s.xp / XP_PER_LEVEL) + 1;
  const progress = (s.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
  const tier = [...TIERS].reverse().find((t) => level >= t.min) ?? TIERS[0];
  const learner = { targetLanguage: s.language, nativeLanguage: s.nativeLanguage, level: s.level };
  const clickMode = (m: Mode) => {
    if (m.premium && !s.premium) return setUpsell(m.title);
    if (m.id === "chat" || m.id === "call" || m.id === "sentence" || m.id === "word" || m.id === "dialogue" || m.id === "characters" || m.id === "roleplay" || m.id === "debate" || m.id === "flashcards" || m.id === "photo") return router.push(`/${m.id}`); // these modes are sets of pages, not modals
    setOpenMode(m);
  };
  const onNav = (id: string) => { setActive(id); setOpenMode(null); };
  // a course picked on the Courses page becomes the selected course and opens its learning path
  const openCourse = (c: Course) => { setCourseId(c.id); saveCourseId(c.id); setActive("learn"); window.scrollTo({ top: 0 }); };

  if (!loaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0D0E17] text-white/70">
        <p>{loadError ?? "Loading…"}</p>
        {loadError && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0D0E17] text-white">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[236px] flex-col justify-between border-r border-white/[0.07] bg-[#11121D] px-6 py-7 md:flex">
        <button onClick={() => { setActive("home"); setOpenMode(null); router.push("/dashboard"); }} aria-label="TalkMate home"
          className="flex items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold tracking-tight text-white">TalkMate</span>
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon, dot }) => (
            <button key={id} onClick={() => onNav(id)}
              className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${active === id ? "bg-violet-600/15 text-violet-300 ring-1 ring-violet-500/20" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}>
              <Icon size={18} />
              {label}
              {dot && <span className="absolute left-[34px] top-2 h-2 w-2 rounded-full bg-pink-500" />}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-1">
          <button
            onClick={claimGift}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-pink-300">
            <Gift size={18} className="text-pink-300" /> A gift for you
          </button>
          <button onClick={() => setActive("account")}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${active === "account" ? "bg-violet-600/15 text-violet-300" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}>
            <User size={18} /> Account
          </button>
        </div>
      </aside>

      <main className="w-full px-4 py-7 md:pl-[260px] md:pr-8 lg:px-10 lg:py-9 lg:pl-[260px]">
        {active === "home" ? (
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-violet-300">YOUR LEARNING SPACE</p>
              <h1 className="mb-2 text-3xl font-bold tracking-tight">Learning modes</h1>
              <p className="text-sm text-white/45">Choose how you want to practice today.</p>
            </div>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {MODES.map((m) => {
                  const locked = m.premium && !s.premium;
                  return (
                    <li key={m.id}>
                      <button onClick={() => clickMode(m)} className="group block w-full rounded-2xl border border-white/[0.07] bg-[#171827] p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-[#1C1D31] hover:shadow-[0_10px_35px_rgba(124,92,255,0.08)] sm:p-4">
                        <div className="relative aspect-[7/4] w-full overflow-hidden rounded-xl ring-1 ring-white/[0.04] transition group-hover:ring-violet-400/20">
                          <ModeImage mode={m} locked={locked} />
                          {locked && (
                            <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#11121D]/85 py-1 pl-1 pr-2.5 text-xs font-bold backdrop-blur">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500"><Lock size={11} /></span>
                              Premium
                            </span>
                          )}
                        </div>
                        <h2 className="mt-3 text-sm font-semibold transition-colors group-hover:text-violet-300">{m.title}</h2>
                        <p className="mt-2 text-xs leading-relaxed text-white/45">{m.desc}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside className="flex flex-col gap-5 lg:self-start">
              {!s.premium && (
                <div className="relative overflow-hidden rounded-2xl border border-violet-400/15 bg-gradient-to-br from-[#30205B] via-[#211B3D] to-[#191827] p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/15 py-1.5 pl-1.5 pr-2.5 text-xs font-bold text-violet-200">
                    <Star size={12} fill="white" /> Premium
                  </span>
                  <h3 className="mt-4 text-xl font-bold">Special offer: up to 79% off!</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">For a limited time TalkMate Premium is on sale.</p>
                  <button onClick={() => setUpsell("Premium")} className="mt-5 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">Get premium</button>
                </div>
              )}

              {!s.premium && (
                <button onClick={() => onNav("account")}
                  className="flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-[#171827] p-5 text-left transition-opacity hover:opacity-90">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-500/15 ring-4 ring-violet-400/10">
                    <Star size={26} fill="white" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold">Get free Premium</span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/45">Invite friends and get free premium subscription.</span>
                  </span>
                </button>
              )}

              <div className="rounded-2xl border border-white/[0.07] bg-[#171827] p-6">
                <div className="flex items-center gap-4">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tier.ring} p-[5px]`}>
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-[#171827]"><Sparkle size={22} fill="white" /></span>
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">Level {level}</h3>
                    <p className="mt-0.5 text-lg text-white/70">{tier.name}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="flex h-full min-w-[3rem] items-center justify-center rounded-full bg-violet-500 text-[11px] font-bold transition-all"
                      style={{ width: `${Math.round(progress * 100)}%` }}>
                      {Math.round(progress * 100)}%
                    </div>
                  </div>
                  <span className="font-semibold text-violet-300">{level + 1}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#171827] px-6">
                <div className="flex items-center justify-between py-6">
                  <span className="text-xl font-semibold">Ongoing streak</span>
                  <span className="rounded-full bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-300">{s.streak} {s.streak === 1 ? "day" : "days"}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 py-6">
                  <span className="text-xl font-semibold">Longest streak</span>
                  <span className="rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/70">{s.longest} {s.longest === 1 ? "day" : "days"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#171827] p-6">
                <h3 className="text-xl font-semibold">Daily feedback</h3>
                <p className="mt-3 text-sm text-white/60">Practice in AI modes and receive personalized daily feedback.</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs font-semibold">See your daily practice feedbacks here</span>
                  <button onClick={() => setFeedbackOpen(true)} aria-label="Open daily feedback"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 hover:bg-violet-400">
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </aside>
            </div>
          </div>
        ) : active === "account" ? (
          <AccountView s={s} onSettings={updateSettings} onLogout={logout} onToast={setToast} onSnapshot={setS} />
        ) : active === "learn" ? (
          <LearnView course={courseById(courseId)} premium={s.premium} onSelectCourse={openCourse} onLocked={setUpsell} />
        ) : active === "courses" ? (
          <CoursesView selected={courseId} onSelect={openCourse} />
        ) : active === "explore" ? (
          <ExploreView premium={s.premium} onLocked={setUpsell} />
        ) : active === "progress" ? (
          <ProgressView s={s} onOpenFeedback={() => setFeedbackOpen(true)} />
        ) : (
          <div className="mx-auto max-w-xl pt-10">
            <h1 className="text-lg font-semibold">{NAV.find((n) => n.id === active)?.label}</h1>
            <p className="mt-4 text-white/60">This section isn't built yet. Pick Home to practice.</p>
          </div>
        )}
      </main>

      {openMode && <PracticeTimer onSnapshot={setS} />}
      {openMode && ["sentence", "word", "dialogue", "flashcards"].includes(openMode.id) && (
        <GeneratePanel type={openMode.id as any} title={openMode.title} learner={learner} onPractice={practice} onClose={() => setOpenMode(null)} />
      )}
      {openMode?.id === "photo" && <PhotoPanel learner={learner} onPractice={practice} onClose={() => setOpenMode(null)} />}

      {feedbackOpen && <FeedbackModal learner={learner} texts={s.today} onClose={() => setFeedbackOpen(false)} />}

      {upsell && (
        <Modal onClose={() => setUpsell(null)} label="Upgrade to Premium">
          <h2 className="text-xl font-semibold">{upsell === "Premium" ? "Get TalkMate Premium" : `${upsell} is a Premium mode`}</h2>
          <p className="mt-2 text-sm text-white/70">Unlock all 10 learning modes. Billing isn't connected in this clone, so this button unlocks everything for testing.</p>
          <button onClick={unlockPremium}
            className="mt-6 w-full rounded-xl bg-violet-500 py-3 text-sm font-semibold hover:bg-violet-400">
            Unlock all modes (demo)
          </button>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#222336] px-5 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>
      )}
    </div>
  );
}

// Picture for a mode card: your own file from /public/modes. Falls back to the emoji if the file is missing.
function ModeImage({ mode, locked }: { mode: Mode; locked: boolean }) {
  const [failed, setFailed] = useState(false);
  const bg = mode.id === "chat" ? "bg-[#F4E7D2]" : "bg-[#25263B]";
  if (failed) {
    return <div className={`flex h-full w-full items-center justify-center text-6xl ${bg} ${locked ? "grayscale" : ""}`}>{mode.emoji}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mode.image} alt={mode.title} onError={() => setFailed(true)} draggable={false}
      className={`h-full w-full object-contain ${bg} ${locked ? "grayscale" : ""}`} />
  );
}

function FeedbackModal({ learner, texts, onClose }: {
  learner: { targetLanguage: string; nativeLanguage?: string; level: string }; texts: string[]; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null);
    try { setText((await api.feedback({ ...learner, texts })).feedback); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} label="Daily feedback" wide>
      <h2 className="text-xl font-semibold">Daily feedback</h2>
      {texts.length === 0 ? (
        <p className="mt-3 text-sm text-white/70">No practice yet today. Chat or describe a photo to get feedback.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-white/70">{texts.length} practice {texts.length === 1 ? "entry" : "entries"} today.</p>
          {!text && (
            <button onClick={run} disabled={busy} className="mt-4 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
              {busy ? "Reviewing…" : "Get today's feedback"}
            </button>
          )}
          <ErrorText text={error} />
          {text && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-white/5 p-4 text-sm">{text}</div>}
        </>
      )}
    </Modal>
  );
}
