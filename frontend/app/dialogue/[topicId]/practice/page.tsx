"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerUpRight, Loader2, Mic, MessageSquareText, RotateCw, Settings, Square, Volume2, VolumeX, X } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { Stars } from "@/components/PronunciationReview";
import { useDialogue } from "@/components/dialogue/DialogueProvider";
import { api, type DialogueSession, type PronunciationResult } from "@/lib/api";
import { dialogueKey, useDialogueId } from "@/lib/dialogue";
import { PASS_SCORE, SCORE_LABEL, loadPrefs, savePrefs, type SentencePrefs } from "@/lib/sentence";
import { SPEECH_LANG } from "@/lib/modes";
import { usePronunciation } from "@/lib/usePronunciation";
import { cancelSpeech, hasVoiceFor, speak } from "@/lib/speech";

type Res = PronunciationResult | "skipped" | null; // null = not spoken yet
type Saved = { average: number; passed: boolean } | null;

const roundBtn = "flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/90 transition-colors hover:bg-white/20 disabled:opacity-40";

// Step 3: the practice screen. The partner speaks, the learner reads their answer out loud and gets a rating.
export default function DialoguePracticePage() {
  const topicId = useDialogueId();
  const router = useRouter();
  const { progress } = useDialogue();
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";
  const key = dialogueKey(topicId, progress.language, progress.level, progress.nativeLanguage);

  const [session, setSession] = useState<DialogueSession | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Res[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<"partner" | "you" | null>(null);
  const [noVoice, setNoVoice] = useState(false);
  const [prefs, setPrefs] = useState<SentencePrefs>({ autoplay: true, slow: false, showTranslation: true });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [summary, setSummary] = useState(false);
  const [saved, setSaved] = useState<Saved>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const started = useRef(false);

  const updatePrefs = (patch: Partial<SentencePrefs>) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  // the rating lands on the turn that was being spoken (idx is read through a ref, as the hook calls this later)
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const { mic, live, error, setError, canListen, start: startMic, stop: stopMic } = usePronunciation({
    lang, learner,
    onResult: (r) => setResults((prev) => prev.map((x, k) => (k === idxRef.current ? r : x))),
  });

  // ---- load: restore an unfinished dialogue, otherwise ask for the script ----
  const load = useCallback(async (fresh = false) => {
    setLoadError(null); setSession(null); setIdx(0); setResults([]); setSummary(false); setSaved(null);
    setSaveError(null); setError(null);
    if (!topicId) { setLoadError("Couldn't tell which dialogue to practise. Go back and pick one."); return; }
    try {
      const s = await api.dialogue.session(topicId, { ...learner, fresh });
      setSession(s); setResults(s.turns.map(() => null));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't create the dialogue");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, progress.language, progress.level, progress.nativeLanguage]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setPrefs(loadPrefs());
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.session?.turns?.length && Array.isArray(s.results)) {
          setSession(s.session); setResults(s.results); setIdx(Math.min(s.idx ?? 0, s.session.turns.length - 1));
          return;
        }
      }
    } catch {}
    load();
  }, [key, load]);

  // keep the dialogue across refreshes until it is finished
  useEffect(() => {
    if (session && !summary) {
      try { sessionStorage.setItem(key, JSON.stringify({ session, idx, results })); } catch {}
    }
  }, [session, idx, results, summary, key]);

  // warn when the browser has no voice for this language
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setNoVoice(!hasVoiceFor(lang));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [lang]);

  const turn = session?.turns[idx];
  const result = results[idx];
  const scored = result && result !== "skipped" ? result : null;
  const passed = !!scored && scored.score >= PASS_SCORE;
  const last = !!session && idx === session.turns.length - 1;

  // ---- listening ----
  const play = useCallback((who: "partner" | "you") => {
    if (!turn) return;
    setSpeaking(who);
    speak(who === "partner" ? turn.partner : turn.you, lang, prefs.slow ? 0.6 : 0.95, () => setSpeaking(null));
  }, [turn, lang, prefs.slow]);
  const playRef = useRef(play);
  playRef.current = play;

  // the partner speaks each new turn by itself
  useEffect(() => {
    if (!session || summary || !prefs.autoplay) return;
    const t = setTimeout(() => playRef.current("partner"), 450);
    return () => { clearTimeout(t); cancelSpeech(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, idx, summary, prefs.autoplay]);

  useEffect(() => () => cancelSpeech(), []);

  const onMic = () => {
    if (!turn) return;
    if (mic === "listening") return stopMic();
    if (mic !== "idle") return;
    cancelSpeech(); setSpeaking(null);
    startMic(turn.you);
  };

  // ---- moving on ----
  const finish = async (final: Res[]) => {
    const scores = final.filter((r): r is PronunciationResult => !!r && r !== "skipped").map((r) => r.score);
    setSummary(true); cancelSpeech();
    try { sessionStorage.removeItem(key); } catch {}
    if (scores.length === 0) return setSaved({ average: 0, passed: false }); // everything skipped: nothing to save
    try {
      const r = await api.dialogue.complete({ topicId, scores });
      setSaved({ average: r.average, passed: r.passed });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your result");
    }
  };
  const advance = (next: Res[]) => {
    cancelSpeech(); setSpeaking(null); setError(null);
    if (session && idx < session.turns.length - 1) setIdx(idx + 1);
    else finish(next);
  };
  const skip = () => { const next = results.map((r, k) => (k === idx ? ("skipped" as const) : r)); setResults(next); advance(next); };
  const close = () => { cancelSpeech(); router.push(`/dialogue/${topicId}`); };

  const busy = mic !== "idle";
  const pct = session ? ((idx + (result ? 1 : 0)) / session.turns.length) * 100 : 0;

  // the practice card: neutral until spoken, green when it passed, pink when it needs another try
  const card = !scored ? "border border-white/10 bg-white/5" : passed ? "bg-emerald-100" : "bg-rose-100";
  const label = mic === "listening" ? (live || "Listening… tap to stop")
    : mic === "evaluating" ? "Checking your pronunciation…"
    : !scored ? "Read it out loud"
    : passed ? SCORE_LABEL[scored.score] + "!" : "Try again, read it out loud";

  return (
    <div className="flex min-h-screen flex-col bg-[#222228]">
      <header className="relative flex items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Dialogue Mode</h1>
        <div className="relative flex items-center gap-4">
          <button onClick={() => { updatePrefs({ autoplay: !prefs.autoplay }); cancelSpeech(); }}
            aria-label={prefs.autoplay ? "Turn off automatic audio" : "Turn on automatic audio"} className="text-white/80 hover:text-white">
            {prefs.autoplay ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={() => setSettingsOpen((o) => !o)} aria-label="Settings" className="text-white/80 hover:text-white"><Settings size={20} /></button>
          <button onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
          {settingsOpen && (
            <div className="absolute right-0 top-12 z-20 w-60 rounded-xl border border-white/10 bg-[#1f1f27] p-3 text-sm shadow-xl">
              {([["slow", "Slow speech"], ["showTranslation", "Show translation"]] as const).map(([k, l]) => (
                <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-white/5">
                  {l}
                  <input type="checkbox" checked={prefs[k]} onChange={(e) => updatePrefs({ [k]: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
                </label>
              ))}
            </div>
          )}
        </div>
        {session && !summary && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} /></div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 py-8">
        {loadError ? (
          <div className="m-auto text-center">
            <ErrorText text={loadError} />
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={() => load()} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
              <button onClick={close} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back</button>
            </div>
          </div>
        ) : !session ? (
          <div className="m-auto flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="animate-spin" />
            <p className="text-sm">Writing your dialogue…</p>
          </div>
        ) : summary ? (
          <Summary session={session} results={results} saved={saved} saveError={saveError}
            onAgain={() => { started.current = true; load(); }}
            onNew={() => { started.current = true; load(true); }}
            onBack={() => router.push("/dialogue")} />
        ) : (
          <>
            {/* the other speaker */}
            <div className="flex flex-col items-center">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-4xl ring-2 ring-white/10">{session.partner.emoji}</div>
              <p className="mt-2 text-xs font-semibold">{session.partner.role}</p>
            </div>
            <section className="mt-3 rounded-2xl border border-white/10 px-5 py-5 text-center">
              <p className="text-[15px] font-semibold leading-snug" lang={lang}>{turn!.partner}</p>
              {prefs.showTranslation && <p className="mt-2 text-[11px] text-white/70">{turn!.partnerTranslation}</p>}
              <ReplayButton onClick={() => play("partner")} active={speaking === "partner"} label="Replay what they said" />
            </section>

            <div className="mt-auto pt-8">
              {noVoice && <p className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}
              {!canListen && <p className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Speech recognition isn&apos;t supported in this browser. Use Chrome or Edge to practise speaking.</p>}
              <ErrorText text={error} />

              {/* the learner's line */}
              <p className="mb-2 mt-3 min-h-[16px] text-center text-[11px] font-semibold text-white/90" aria-live="polite">{label}</p>
              <section className={`rounded-2xl px-5 py-5 text-center ${card}`}>
                <p className={`text-[15px] font-semibold leading-snug ${!scored ? "text-white" : passed ? "text-emerald-700" : "text-rose-600"}`} lang={lang}>
                  {scored ? scored.words.map((w, i) => (
                    <span key={i} className={w.ok ? (passed ? "text-emerald-700" : "text-rose-400") : "text-rose-600 underline decoration-rose-400 underline-offset-4"}>
                      {w.text}{scored.spaced && i < scored.words.length - 1 ? " " : ""}
                    </span>
                  )) : turn!.you}
                </p>
                {prefs.showTranslation && <p className={`mt-2 text-[11px] ${scored ? "text-black/55" : "text-white/70"}`}>{turn!.youTranslation}</p>}
                <ReplayButton onClick={() => play("you")} active={speaking === "you"} label="Hear how to say it" light={!!scored} />
              </section>

              {scored && (
                <div className="mt-3 rounded-2xl bg-[#26262d] p-4 text-sm">
                  <div className="flex items-center gap-3"><Stars n={scored.score} size={18} /><span className="font-semibold">{scored.score}/5</span></div>
                  {scored.feedback && <p className="mt-2">{scored.feedback}</p>}
                  {scored.tip && <p className="mt-1 text-white/70"><span className="font-semibold text-white/90">Tip:</span> {scored.tip}</p>}
                  <p className="mt-2 text-xs text-white/50">We heard: “{scored.heard}”</p>
                </div>
              )}
              {result && (
                <button onClick={() => advance(results)} disabled={busy}
                  className="mt-3 w-full rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold hover:bg-indigo-600 disabled:opacity-40">
                  {last ? "Finish" : "Continue"}
                </button>
              )}

              <div className="mt-6 flex items-center justify-center gap-10">
                <button onClick={skip} disabled={busy || !!result} aria-label="Skip this line" className={`${roundBtn} ${result ? "invisible" : ""}`}><CornerUpRight size={18} /></button>
                <button onClick={onMic} disabled={mic === "evaluating" || !canListen}
                  aria-label={mic === "listening" ? "Stop recording" : scored ? "Try again" : "Start speaking"}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${mic === "listening" ? "animate-pulse bg-red-500" : "bg-indigo-700 hover:bg-indigo-600"}`}>
                  {mic === "evaluating" ? <Loader2 className="animate-spin" size={22} /> : mic === "listening" ? <Square size={18} fill="white" /> : <Mic size={22} />}
                </button>
                <button onClick={() => setHistoryOpen(true)} aria-label="Show the conversation so far" className={roundBtn}><MessageSquareText size={18} /></button>
              </div>
            </div>
          </>
        )}
      </main>

      {historyOpen && session && (
        <Modal label="Conversation so far" onClose={() => setHistoryOpen(false)} wide>
          <h2 className="text-base font-semibold">{session.title}</h2>
          <ul className="mt-4 space-y-3">
            {session.turns.slice(0, idx + 1).flatMap((t, i) => [
              <li key={`p${i}`} className="mr-10 rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3 text-sm">
                <p className="text-[11px] font-semibold text-white/50">{session.partner.role}</p>
                <p lang={lang}>{t.partner}</p>
                {prefs.showTranslation && <p className="mt-1 text-xs text-white/60">{t.partnerTranslation}</p>}
              </li>,
              ...(i < idx || result ? [
                <li key={`y${i}`} className="ml-10 rounded-2xl rounded-tr-sm bg-indigo-700/60 px-4 py-3 text-sm">
                  <p className="text-[11px] font-semibold text-white/60">You</p>
                  <p lang={lang}>{t.you}</p>
                  {prefs.showTranslation && <p className="mt-1 text-xs text-white/70">{t.youTranslation}</p>}
                </li>,
              ] : []),
            ])}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function ReplayButton({ onClick, active, label, light }: { onClick: () => void; active: boolean; label: string; light?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label}
      className={`mx-auto mt-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${light ? "bg-black/10 text-black/70 hover:bg-black/20" : "bg-white/15 text-white/90 hover:bg-white/25"} ${active ? "animate-pulse" : ""}`}>
      <RotateCw size={13} />
    </button>
  );
}

function Summary({ session, results, saved, saveError, onAgain, onNew, onBack }: {
  session: DialogueSession; results: Res[]; saved: Saved; saveError: string | null;
  onAgain: () => void; onNew: () => void; onBack: () => void;
}) {
  const done = results.filter((r): r is PronunciationResult => !!r && r !== "skipped");
  return (
    <div className="w-full">
      <div className="rounded-2xl bg-[#26262d] p-6 text-center">
        {done.length === 0 ? (
          <>
            <h2 className="text-xl font-semibold">Nothing practised</h2>
            <p className="mt-2 text-sm text-white/60">You skipped every line, so nothing was saved.</p>
          </>
        ) : !saved && !saveError ? (
          <p className="flex items-center justify-center gap-2 text-white/70"><Loader2 className="animate-spin" size={18} /> Saving your result…</p>
        ) : (
          <>
            {saved && (
              <>
                <h2 className="text-xl font-semibold">{saved.passed ? "Dialogue completed!" : "Keep practising"}</h2>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Stars n={Math.round(saved.average)} size={26} />
                  <span className="text-lg font-semibold">{saved.average.toFixed(1)}/5</span>
                </div>
                {!saved.passed && <p className="mt-2 text-sm text-white/60">You need an average of {PASS_SCORE}.0 to complete this dialogue.</p>}
              </>
            )}
            <ErrorText text={saveError} />
          </>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {session.turns.map((t, i) => {
          const r = results[i];
          return (
            <li key={i} className="flex items-center justify-between gap-4 rounded-xl bg-[#26262d] px-4 py-3 text-sm">
              <span>{t.you}</span>
              {r && r !== "skipped" ? <Stars n={r.score} size={14} /> : <span className="shrink-0 text-xs text-white/40">Skipped</span>}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex gap-3">
        <button onClick={onAgain} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Practise again</button>
        <button onClick={onBack} className="flex-1 rounded-xl bg-indigo-700 py-3 text-sm font-semibold hover:bg-indigo-600">Back to dialogues</button>
      </div>
      <button onClick={onNew} className="mt-3 w-full text-center text-sm font-semibold text-white/70 hover:text-white">New dialogue</button>
    </div>
  );
}
