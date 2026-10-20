"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, GraduationCap, BookOpen, Star, TrendingUp, Gift, User, Lock, ArrowRight,
} from "lucide-react";
import { Modal, Select, ErrorText } from "@/components/Modal";
import { ChatPanel } from "@/components/ChatPanel";
import { GeneratePanel } from "@/components/GeneratePanel";
import { PhotoPanel } from "@/components/PhotoPanel";
import { PracticeTimer } from "@/components/PracticeTimer";
import { ProgressView } from "@/components/ProgressView";
import { AccountView } from "@/components/account/AccountView";
import { api, clearToken, getToken, type Progress } from "@/lib/api";
import { LANGUAGES, LEVELS, MODES, type Mode } from "@/lib/modes";

const NAV = [
  { id: "home", label: "Home", icon: LayoutGrid, dot: false, pink: false },
  { id: "courses", label: "Courses", icon: GraduationCap, dot: true, pink: false },
  { id: "explore", label: "Explore", icon: BookOpen, dot: false, pink: false },
  { id: "premium", label: "Premium", icon: Star, dot: false, pink: true },
  { id: "progress", label: "Progress", icon: TrendingUp, dot: false, pink: false },
];

const XP_PER_LEVEL = 50;
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

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.progress.get()
      .then((p) => {
        setS(p); setLoaded(true);
        // the Sentence Mode sidebar links here with ?tab=progress
        if (new URLSearchParams(window.location.search).get("tab") === "progress") setActive("progress");
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
  const learner = { targetLanguage: s.language, nativeLanguage: s.nativeLanguage, level: s.level };
  const clickMode = (m: Mode) => {
    if (m.premium && !s.premium) return setUpsell(m.title);
    if (m.id === "sentence" || m.id === "word" || m.id === "dialogue" || m.id === "flashcards") return router.push(`/${m.id}`); // these modes are sets of pages, not modals
    setOpenMode(m);
  };
  const onNav = (id: string) => (id === "premium" ? setUpsell("Premium") : setActive(id));

  if (!loaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#16161c] text-white/70">
        <p>{loadError ?? "Loading…"}</p>
        {loadError && <button onClick={() => location.reload()} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Try again</button>}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#16161c] text-white">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[236px] flex-col justify-between border-r border-white/5 bg-[#16161c] px-6 py-6 md:flex">
        <button onClick={() => { setActive("home"); setOpenMode(null); router.push("/dashboard"); }} aria-label="TalkMate home"
          className="flex items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M6 8l8 8-8 8M16 8l8 8-8 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-lg font-bold tracking-tight">TalkMate</span>
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon, dot, pink }) => (
            <button key={id} onClick={() => onNav(id)}
              className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${active === id ? "bg-white/10" : "text-white/80 hover:bg-white/5"}`}>
              <Icon size={18} className={pink ? "text-pink-500" : ""} />
              {label}
              {dot && <span className="absolute left-[34px] top-2 h-2 w-2 rounded-full bg-pink-500" />}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-1">
          <button
            onClick={claimGift}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5">
            <Gift size={18} className="text-pink-400" /> A gift for you
          </button>
          <button onClick={() => setActive("account")}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${active === "account" ? "bg-white/10" : "text-white/80 hover:bg-white/5"}`}>
            <User size={18} /> Account
          </button>
        </div>
      </aside>

      <main className="w-full px-4 py-10 md:pl-[236px]">
        {active === "home" ? (
          <div className="mx-auto grid max-w-[1036px] gap-6 lg:grid-cols-[687px_324px] lg:justify-center">
            <section>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold">Learning modes</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50">My language</span>
                  <Select label="My language" value={s.nativeLanguage} onChange={(v) => updateSettings({ nativeLanguage: v })} options={LANGUAGES} />
                  <span className="ml-1 text-xs text-white/50">Learning</span>
                  <Select label="Language" value={s.language} onChange={(v) => updateSettings({ language: v })} options={LANGUAGES} />
                  <Select label="Level" value={s.level} onChange={(v) => updateSettings({ level: v })} options={LEVELS} />
                </div>
              </div>
              <ul className="flex flex-col gap-5">
                {MODES.map((m) => {
                  const locked = m.premium && !s.premium;
                  return (
                    <li key={m.id} className="relative">
                      {locked && (
                        <span className="absolute right-3 top-[-10px] z-[1] flex items-center gap-1 rounded-full bg-[#16161c] px-2 py-1 text-[11px] font-bold">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pink-500"><Lock size={9} /></span>
                          Premium
                        </span>
                      )}
                      <button onClick={() => clickMode(m)}
                        className="flex h-[144px] w-full overflow-hidden rounded-2xl border border-white/5 bg-[#1f1f27] text-left transition-colors hover:border-white/20">
                        <div className={`flex w-[142px] shrink-0 items-center justify-center text-5xl ${m.id === "chat" ? "bg-yellow-300" : "bg-zinc-800"} ${locked ? "grayscale" : ""}`}>
                          {m.emoji}
                        </div>
                        <div className="flex flex-col justify-center px-4">
                          <h2 className="text-xl font-semibold">{m.title}</h2>
                          <p className="mt-2 text-[13px] text-white/80">{m.desc}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside className="flex flex-col gap-4 lg:mt-[60px] lg:self-start">
              {!s.premium && (
                <div className="rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 p-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[11px] font-bold">
                    <Star size={11} fill="white" /> Premium
                  </span>
                  <h3 className="mt-3 text-xl font-semibold">Special offer: up to 79% off!</h3>
                  <p className="mt-1 text-[11px] font-semibold">For a limited time TalkMate Premium is on sale.</p>
                  <button onClick={() => setUpsell("Premium")} className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">Get premium</button>
                </div>
              )}

              <div className="rounded-2xl border border-white/5 bg-[#1f1f27] p-6">
                <h3 className="text-xl font-semibold">Level {level}</h3>
                <p className="mt-3 text-sm text-white/70">Your current level.</p>
                <div className="mt-6 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                  <span className="font-semibold">{level}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-white/40">{level + 1}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#1f1f27] px-6">
                <div className="flex items-center justify-between py-6">
                  <span className="text-lg font-semibold">Ongoing streak</span>
                  <span className="rounded-full bg-indigo-700 px-3 py-3 text-sm font-semibold">{s.streak} {s.streak === 1 ? "day" : "days"}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 py-5">
                  <span className="text-lg font-semibold">Longest streak</span>
                  <span className="rounded-full bg-white/10 px-3 py-3 text-sm font-semibold">{s.longest} {s.longest === 1 ? "day" : "days"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#1f1f27] p-6">
                <h3 className="text-xl font-semibold">Daily feedback</h3>
                <p className="mt-3 text-sm text-white/60">Practice in AI modes and receive personalized daily feedback.</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs font-semibold">See your daily practice feedbacks here</span>
                  <button onClick={() => setFeedbackOpen(true)} aria-label="Open daily feedback"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500">
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        ) : active === "account" ? (
          <AccountView s={s} onLanguage={(language) => updateSettings({ language })} onLogout={logout} onToast={setToast} onSnapshot={setS} />
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
      {openMode && ["chat", "call", "roleplay", "characters", "debate"].includes(openMode.id) && (
        <ChatPanel mode={openMode.id as any} title={openMode.title} learner={learner} onPractice={practice} onClose={() => setOpenMode(null)} />
      )}
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
            className="mt-6 w-full rounded-full bg-pink-500 py-3 text-sm font-semibold hover:bg-pink-400">
            Unlock all modes (demo)
          </button>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg">{toast}</div>
      )}
    </div>
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
