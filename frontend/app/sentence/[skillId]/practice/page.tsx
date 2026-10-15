"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Mic, RotateCw, Settings, Square, Star, Volume2, VolumeX, X } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { useSentence } from "@/components/sentence/SentenceProvider";
import { api, type PronunciationResult, type SentenceItem } from "@/lib/api";
import { PASS_SCORE, SCORE_LABEL, loadPrefs, savePrefs, sessionKey, useSkillId, type SentencePrefs } from "@/lib/sentence";
import { SPEECH_LANG } from "@/lib/modes";
import {
  cancelSpeech, createRecognition, hasVoiceFor, speak, supportsSpeechRecognition,
} from "@/lib/speech";

type Res = PronunciationResult | "skipped" | null; // null = not attempted yet
type Mic = "idle" | "listening" | "evaluating";
type Saved = { average: number; passed: boolean } | null;

const Stars = ({ n, size = 18 }: { n: number; size?: number }) => (
  <span className="inline-flex gap-0.5" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} className={i <= n ? "fill-yellow-400 text-yellow-400" : "text-white/25"} />
    ))}
  </span>
);

// Page 2: five AI sentences. Listen, speak, get a 1-5 rating.
export default function SentencePracticePage() {
  const skillId = useSkillId();
  const router = useRouter();
  const { progress, units, reloadUnits } = useSentence();
  const skill = units?.units.flatMap((u) => u.skills).find((k) => k.id === skillId);
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";
  const key = sessionKey(skillId, progress.language, progress.level, progress.nativeLanguage);

  const [items, setItems] = useState<SentenceItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Res[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mic, setMic] = useState<Mic>("idle");
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [canListen, setCanListen] = useState(true);
  const [prefs, setPrefs] = useState<SentencePrefs>({ autoplay: true, slow: false, showTranslation: true });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summary, setSummary] = useState(false);
  const [saved, setSaved] = useState<Saved>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const started = useRef(false);

  const updatePrefs = (patch: Partial<SentencePrefs>) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  // ---- load: restore an unfinished session, otherwise ask the AI for 5 new sentences ----
  const load = useCallback(async () => {
    setLoadError(null); setItems(null); setIdx(0); setResults([]); setSummary(false); setSaved(null);
    setSaveError(null); setError(null); setShowNote(false); setMic("idle");
    if (!skillId) { setLoadError("Couldn't tell which skill to practise. Go back and pick one."); return; }
    try {
      const s = await api.sentence.session(skillId, learner);
      setItems(s.items); setResults(s.items.map(() => null));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't create sentences");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, progress.language, progress.level, progress.nativeLanguage]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setPrefs(loadPrefs());
    setCanListen(supportsSpeechRecognition());
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.items) && s.items.length && Array.isArray(s.results)) {
          setItems(s.items); setResults(s.results); setIdx(Math.min(s.idx ?? 0, s.items.length - 1));
          return;
        }
      }
    } catch {}
    load();
  }, [key, load]);

  // keep the session across refreshes until it is finished
  useEffect(() => {
    if (items && !summary) {
      try { sessionStorage.setItem(key, JSON.stringify({ items, idx, results })); } catch {}
    }
  }, [items, idx, results, summary, key]);

  // warn when the browser has no voice for this language
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setNoVoice(!hasVoiceFor(lang));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [lang]);

  // ---- listening to the sentence ----
  const play = useCallback(() => {
    if (!items) return;
    setSpeaking(true);
    speak(items[idx].sentence, lang, prefs.slow ? 0.6 : 0.95, () => setSpeaking(false));
  }, [items, idx, lang, prefs.slow]);
  const playRef = useRef(play);
  playRef.current = play;

  const current = items?.[idx];
  const result = results[idx];
  const scored = result && result !== "skipped" ? result : null;

  useEffect(() => {
    if (!items || summary || !prefs.autoplay || results[idx]) return;
    const t = setTimeout(() => playRef.current(), 400);
    return () => { clearTimeout(t); cancelSpeech(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, idx, summary, prefs.autoplay]);

  useEffect(() => () => { recRef.current?.abort?.(); cancelSpeech(); }, []);

  // ---- speaking the sentence ----
  const evaluate = async (i: number, sentence: string, transcript: string, confidence?: number) => {
    setMic("evaluating");
    try {
      const r = await api.sentence.evaluate({ ...learner, sentence, transcript, confidence });
      setResults((prev) => prev.map((x, k) => (k === i ? r : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check your pronunciation");
    } finally {
      setMic("idle"); setLive("");
    }
  };

  const startListening = () => {
    if (!current) return;
    const rec = createRecognition(lang);
    if (!rec) return setError("Speech recognition isn't supported in this browser. Please use Chrome or Edge.");
    cancelSpeech(); setSpeaking(false); setError(null); setLive("");

    const i = idx, sentence = current.sentence;
    let transcript = "", confidence: number | undefined, failed = false;
    rec.onresult = (e: any) => {
      let t = ""; const conf: number[] = [];
      for (let k = 0; k < e.results.length; k++) {
        t += e.results[k][0].transcript + " ";
        if (e.results[k].isFinal && e.results[k][0].confidence > 0) conf.push(e.results[k][0].confidence);
      }
      transcript = t.trim();
      confidence = conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : undefined;
      setLive(transcript);
    };
    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      failed = true;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser's address bar, then try again."
          : e.error === "no-speech" ? "I didn't hear anything. Tap the mic and try again."
          : e.error === "network" ? "Speech recognition needs an internet connection."
          : e.error === "audio-capture" ? "No microphone was found."
          : "Couldn't listen. Please try again.",
      );
    };
    rec.onend = () => {
      recRef.current = null;
      if (failed) return setMic("idle");
      if (!transcript) { setError("I didn't hear anything. Tap the mic and try again."); return setMic("idle"); }
      evaluate(i, sentence, transcript, confidence);
    };
    recRef.current = rec;
    try { rec.start(); setMic("listening"); } catch { setError("Couldn't start the microphone. Please try again."); }
  };

  const onMic = () => (mic === "listening" ? recRef.current?.stop() : mic === "idle" ? startListening() : undefined);

  // ---- moving on ----
  const finish = async (final: Res[]) => {
    const scores = final.filter((r): r is PronunciationResult => !!r && r !== "skipped").map((r) => r.score);
    setSummary(true); cancelSpeech();
    try { sessionStorage.removeItem(key); } catch {}
    if (scores.length === 0) return setSaved({ average: 0, passed: false }); // everything skipped: nothing to save
    try {
      const r = await api.sentence.complete({ skillId, scores });
      setSaved({ average: r.average, passed: r.passed });
      reloadUnits();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your result");
    }
  };

  const advance = (next: Res[]) => {
    cancelSpeech(); setSpeaking(false); setError(null); setLive(""); setShowNote(false);
    if (items && idx < items.length - 1) setIdx(idx + 1);
    else finish(next);
  };
  const skip = () => { const next = results.map((r, k) => (k === idx ? ("skipped" as const) : r)); setResults(next); advance(next); };
  const retry = () => { setResults((p) => p.map((r, k) => (k === idx ? null : r))); setError(null); };
  const close = () => { cancelSpeech(); router.push(`/sentence/${skillId}`); };

  // ---- render ----
  const total = items?.length ?? 5;
  const pct = ((idx + 1) / total) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-[#222228]">
      <header className="relative flex items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Sentence Mode</h1>
        <div className="relative flex items-center gap-4">
          <button onClick={() => { updatePrefs({ autoplay: !prefs.autoplay }); cancelSpeech(); }}
            aria-label={prefs.autoplay ? "Turn off automatic audio" : "Turn on automatic audio"}
            className="text-white/80 hover:text-white">
            {prefs.autoplay ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={() => setSettingsOpen((o) => !o)} aria-label="Settings" className="text-white/80 hover:text-white"><Settings size={20} /></button>
          <button onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
          {settingsOpen && (
            <div className="absolute right-0 top-12 z-20 w-60 rounded-xl border border-white/10 bg-[#1f1f27] p-3 text-sm shadow-xl">
              {([["slow", "Slow speech"], ["showTranslation", "Show translation"]] as const).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-white/5">
                  {label}
                  <input type="checkbox" checked={prefs[k]} onChange={(e) => updatePrefs({ [k]: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
                </label>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1156px] flex-1 flex-col px-5 py-6">
        {loadError ? (
          <div className="m-auto text-center">
            <ErrorText text={loadError} />
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={load} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
              <button onClick={close} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back</button>
            </div>
          </div>
        ) : !items ? (
          <div className="m-auto flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="animate-spin" />
            <p className="text-sm">Creating {skill ? `"${skill.title}" ` : ""}sentences for you…</p>
          </div>
        ) : summary ? (
          <Summary items={items} results={results} saved={saved} saveError={saveError}
            onAgain={() => { started.current = true; load(); }} onBack={() => router.push("/sentence")} />
        ) : (
          <>
            {/* progress bar with a "1 / 5" marker at the current position */}
            <div className="relative mt-2 h-1.5 rounded-full bg-indigo-300/60">
              <div className="h-full rounded-full bg-indigo-700 transition-all" style={{ width: `${pct}%` }} />
              <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black transition-all"
                style={{ left: `${pct}%` }}>
                {idx + 1} <span className="font-normal text-black/50">/ {total}</span>
              </span>
            </div>

            <section className="mt-10 rounded-2xl bg-[#26262d] p-6">
              <p className="text-xs font-semibold text-white/80">Read out loud</p>
              <p className="mt-4 min-h-[56px] text-2xl font-semibold leading-snug" lang={lang}>
                {scored ? scored.words.map((w, i) => (
                  <span key={i} className={w.ok ? "text-emerald-300" : "text-red-300 underline decoration-red-400/60 underline-offset-4"}>
                    {w.text}{scored.spaced && i < scored.words.length - 1 ? " " : ""}
                  </span>
                )) : current!.sentence}
              </p>
              <div className="mt-6 flex items-center gap-2">
                <button onClick={play} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ${speaking ? "animate-pulse text-indigo-300" : ""}`}><RotateCw size={13} /></span>
                  Replay
                </button>
                <button onClick={() => setShowNote((s) => !s)} aria-expanded={showNote}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"><Info size={13} /></span>
                  Explain
                </button>
              </div>
              {showNote && (
                <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/80">
                  {current!.note || "No extra notes for this sentence."}
                </p>
              )}
            </section>

            {prefs.showTranslation && (
              <div className="mt-6 px-6">
                <p className="text-xs font-semibold text-white/80">Translation</p>
                <p className="mt-3 text-sm font-semibold">{current!.translation}</p>
              </div>
            )}

            <div className="px-6">
              {noVoice && <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}
              {!canListen && <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Speech recognition isn't supported in this browser. Use Chrome or Edge to practise speaking.</p>}
              <ErrorText text={error} />
            </div>

            {scored ? (
              <Review r={scored} last={idx === items.length - 1} onRetry={retry} onNext={() => advance(results)} />
            ) : (
              <div className="mt-auto flex flex-col items-center gap-2 pb-6 pt-10">
                <p className="min-h-[20px] text-center text-sm text-white/60" aria-live="polite">
                  {mic === "listening" ? (live || "Listening… tap to stop") : mic === "evaluating" ? "Checking your pronunciation…" : "Tap the mic and read the sentence"}
                </p>
                <button onClick={onMic} disabled={mic === "evaluating" || !canListen}
                  aria-label={mic === "listening" ? "Stop recording" : "Start speaking"}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${mic === "listening" ? "animate-pulse bg-red-500" : "bg-indigo-700 hover:bg-indigo-600"}`}>
                  {mic === "evaluating" ? <Loader2 className="animate-spin" size={22} /> : mic === "listening" ? <Square size={18} fill="white" /> : <Mic size={22} />}
                </button>
                <button onClick={skip} disabled={mic !== "idle"} className="mt-2 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-40">Skip</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Review({ r, last, onRetry, onNext }: { r: PronunciationResult; last: boolean; onRetry: () => void; onNext: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-[#26262d] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Stars n={r.score} size={22} />
        <span className="text-lg font-semibold">{r.score}/5</span>
        <span className="text-sm text-white/60">{SCORE_LABEL[r.score]}</span>
      </div>
      {r.feedback && <p className="mt-3 text-sm">{r.feedback}</p>}
      {r.tip && <p className="mt-2 text-sm text-white/70"><span className="font-semibold text-white/90">Tip:</span> {r.tip}</p>}
      <p className="mt-3 text-xs text-white/50">We heard: “{r.heard}”</p>
      {r.source === "fallback" && (
        <p className="mt-1 text-xs text-white/40">AI feedback wasn't available, so this score is based on how closely your words matched.</p>
      )}
      <div className="mt-5 flex gap-3">
        <button onClick={onRetry} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Try again</button>
        <button onClick={onNext} className="flex-1 rounded-xl bg-indigo-700 py-3 text-sm font-semibold hover:bg-indigo-600">{last ? "Finish" : "Next"}</button>
      </div>
    </div>
  );
}

function Summary({ items, results, saved, saveError, onAgain, onBack }: {
  items: SentenceItem[]; results: Res[]; saved: Saved; saveError: string | null; onAgain: () => void; onBack: () => void;
}) {
  const done = results.filter((r): r is PronunciationResult => !!r && r !== "skipped");
  return (
    <div className="mx-auto mt-6 w-full max-w-xl">
      <div className="rounded-2xl bg-[#26262d] p-6 text-center">
        {done.length === 0 ? (
          <>
            <h2 className="text-xl font-semibold">No sentences practised</h2>
            <p className="mt-2 text-sm text-white/60">You skipped every sentence, so nothing was saved.</p>
          </>
        ) : !saved && !saveError ? (
          <p className="flex items-center justify-center gap-2 text-white/70"><Loader2 className="animate-spin" size={18} /> Saving your result…</p>
        ) : (
          <>
            {saved && (
              <>
                <h2 className="text-xl font-semibold">{saved.passed ? "Skill completed!" : "Keep practising"}</h2>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Stars n={Math.round(saved.average)} size={26} />
                  <span className="text-lg font-semibold">{saved.average.toFixed(1)}/5</span>
                </div>
                {!saved.passed && <p className="mt-2 text-sm text-white/60">You need an average of {PASS_SCORE}.0 to complete this skill.</p>}
              </>
            )}
            <ErrorText text={saveError} />
          </>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((it, i) => {
          const r = results[i];
          return (
            <li key={i} className="flex items-center justify-between gap-4 rounded-xl bg-[#26262d] px-4 py-3 text-sm">
              <span>{it.sentence}</span>
              {r && r !== "skipped" ? <Stars n={r.score} size={14} /> : <span className="shrink-0 text-xs text-white/40">Skipped</span>}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex gap-3">
        <button onClick={onAgain} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Practise again</button>
        <button onClick={onBack} className="flex-1 rounded-xl bg-indigo-700 py-3 text-sm font-semibold hover:bg-indigo-600">Back to units</button>
      </div>
    </div>
  );
}
