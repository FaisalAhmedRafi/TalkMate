"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Mic, RotateCw, Settings, Square, Volume2, VolumeX, X } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { useWord } from "@/components/word/WordProvider";
import { ColoredSentence, Review, Stars } from "@/components/PronunciationReview";
import { api, type PronunciationResult, type WordLesson } from "@/lib/api";
import { PASS_SCORE, loadPrefs, savePrefs, type SentencePrefs } from "@/lib/sentence";
import { SPEECH_LANG } from "@/lib/modes";
import { cancelSpeech, hasVoiceFor, speak } from "@/lib/speech";
import { usePronunciation } from "@/lib/usePronunciation";
import { nextWordId, useWordId } from "@/lib/word";

type Saved = { average: number; passed: boolean } | null;
const padScores = (s: (number | null)[], n: number) => Array.from({ length: n }, (_, i) => s[i] ?? null);

// One word lesson: the word card with its photo, then sentences made from the word to read aloud.
export default function WordLessonPage() {
  const wordId = useWordId();
  const router = useRouter();
  const { progress, units, reloadUnits } = useWord();
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";

  const [lesson, setLesson] = useState<WordLesson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0 = the word card, 1..n = a sentence
  const [scores, setScores] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<PronunciationResult | null>(null); // the rating for the sentence on screen
  const [explain, setExplain] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [prefs, setPrefs] = useState<SentencePrefs>({ autoplay: true, slow: false, showTranslation: true });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summary, setSummary] = useState(false);
  const [saved, setSaved] = useState<Saved>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const startedFor = useRef<string | null>(null); // the word that is already loaded or loading
  const lastRestart = useRef(false); // so "Try again" repeats what was asked: resume, or start over

  const n = lesson?.sentences.length ?? 3;
  const sentence = step >= 1 ? lesson?.sentences[step - 1] : undefined;
  const updatePrefs = (patch: Partial<SentencePrefs>) => setPrefs((p) => { const x = { ...p, ...patch }; savePrefs(x); return x; });

  // ---- saving where the learner is, so "Continue the exercise" can pick up from here ----
  const persist = useCallback((s: number, sc: (number | null)[]) => {
    api.word.save({ wordId, language: progress.language, step: s, scores: sc }).catch(() => {}); // best effort; the next move saves again
  }, [wordId, progress.language]);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const stepRef = useRef(step);
  stepRef.current = step;
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  const stopVoice = useCallback(() => { cancelSpeech(); setSpeaking(false); }, []);

  // ---- microphone and rating (same flow as Sentence Mode) ----
  const pron = usePronunciation({
    lang,
    learner,
    onResult: (r) => {
      setResult(r);
      const next = scoresRef.current.map((s, k) => (k === stepRef.current - 1 ? r.score : s));
      setScores(next);
      persistRef.current(stepRef.current, next);
    },
  });

  // ---- opening the lesson: resume a saved one, or make a new one ----
  const load = useCallback(async (restart: boolean) => {
    lastRestart.current = restart;
    setLoadError(null); setLesson(null); setStep(0); setScores([]); setResult(null);
    setSummary(false); setSaved(null); setSaveError(null); setExplain(false); setImgFailed(false);
    try {
      const l = await api.word.start(wordId, { ...learner, restart });
      setLesson(l);
      setStep(l.step);
      setScores(padScores(l.scores, l.sentences.length));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't create the lesson");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId, progress.language, progress.nativeLanguage, progress.level]);

  useEffect(() => {
    if (startedFor.current === wordId) return; // also reloads when "Next word" moves to another word
    const first = startedFor.current === null;
    startedFor.current = wordId;
    if (first) setPrefs(loadPrefs());
    const restart = new URLSearchParams(window.location.search).get("restart") === "1";
    if (restart) window.history.replaceState(null, "", window.location.pathname); // a refresh must not restart again
    load(restart);
  }, [wordId, load]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setNoVoice(!hasVoiceFor(lang));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [lang]);

  // ---- listening to the word or the sentence ----
  const play = useCallback(() => {
    if (!lesson) return;
    const text = step === 0 ? lesson.word : lesson.sentences[step - 1]?.sentence;
    if (!text) return;
    setSpeaking(true);
    speak(text, lang, prefs.slow ? 0.6 : 0.95, () => setSpeaking(false));
  }, [lesson, step, lang, prefs.slow]);
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    if (!lesson || summary || !prefs.autoplay || result) return;
    const t = setTimeout(() => playRef.current(), 400);
    return () => { clearTimeout(t); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, step, summary, prefs.autoplay]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  useEffect(() => {
    if (!explain) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExplain(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explain]);

  // ---- moving on ----
  const finish = async (final: (number | null)[]) => {
    setSummary(true);
    stopVoice();
    try {
      const r = await api.word.complete({ wordId, language: progress.language, scores: final });
      setSaved({ average: r.average, passed: r.passed });
      reloadUnits();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your result");
    }
  };

  const go = (nextScores: (number | null)[]) => {
    stopVoice(); setResult(null); pron.setError(null); setExplain(false);
    if (step < n) { setStep(step + 1); persist(step + 1, nextScores); }
    else finish(nextScores);
  };
  const skip = () => { const ns = scores.map((s, k) => (k === step - 1 ? null : s)); setScores(ns); go(ns); };
  const retry = () => {
    const ns = scores.map((s, k) => (k === step - 1 ? null : s));
    setScores(ns); setResult(null); pron.setError(null); persist(step, ns);
  };
  const close = () => { stopVoice(); router.push("/word"); };
  const onMic = () => (pron.mic === "listening" ? pron.stop() : pron.mic === "idle" && sentence ? (stopVoice(), pron.start(sentence.sentence)) : undefined);

  const next = nextWordId(units, wordId);

  return (
    <div className="flex min-h-screen flex-col bg-[#222228]">
      <header className="relative flex items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Word Mode</h1>
        <div className="relative flex items-center gap-4">
          <button onClick={() => { updatePrefs({ autoplay: !prefs.autoplay }); stopVoice(); }}
            aria-label={prefs.autoplay ? "Turn off automatic audio" : "Turn on automatic audio"} className="text-white/80 hover:text-white">
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
              <button onClick={() => load(lastRestart.current)} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
              <button onClick={close} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back</button>
            </div>
          </div>
        ) : !lesson ? (
          <div className="m-auto flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="animate-spin" />
            <p className="text-sm">Preparing your word…</p>
          </div>
        ) : summary ? (
          <Summary lesson={lesson} scores={scores} saved={saved} saveError={saveError} hasNext={!!next}
            onNext={() => next && router.push(`/word/${next}`)} onAgain={() => load(true)} onBack={() => router.push("/word")} />
        ) : (
          <>
            {/* progress: one stop for the word card and one for each sentence */}
            <div className="relative mx-2 mt-2 h-4" aria-label={`Step ${step + 1} of ${n + 1}`}>
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/20" />
              <div className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-indigo-400 transition-all" style={{ width: `${(step / n) * 100}%` }} />
              {Array.from({ length: n + 1 }, (_, i) => (
                <span key={i} style={{ left: `${(i / n) * 100}%` }}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
                    i === step ? "h-3.5 w-3.5 bg-white" : i < step ? "h-2 w-2 bg-indigo-400" : "h-1.5 w-1.5 bg-white/30"
                  }`} />
              ))}
            </div>

            {step === 0 ? (
              <div className="mx-auto mt-10 w-full max-w-[408px]">
                <div className="rounded-[28px] border border-white/80 px-8 pb-8 pt-8 text-center">
                  {lesson.image && !imgFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lesson.image.url} alt="" onError={() => setImgFailed(true)} className="mx-auto h-[200px] w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="mx-auto flex h-[200px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-8xl">{lesson.emoji}</div>
                  )}
                  <h2 className="mt-5 text-3xl font-semibold" lang={lang}>{lesson.word}</h2>
                  <button onClick={play} aria-label="Play the word"
                    className={`mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 hover:bg-indigo-600 ${speaking ? "animate-pulse" : ""}`}>
                    <RotateCw size={22} />
                  </button>
                  <p className="mt-4 text-lg text-white/80">{lesson.translation}</p>
                </div>
                {lesson.image && !imgFailed && (
                  <p className="mt-2 text-center text-[11px] text-white/40">
                    Photo by <a href={lesson.image.creditUrl} target="_blank" rel="noreferrer" className="underline">{lesson.image.credit}</a> on{" "}
                    <a href={lesson.image.sourceUrl ?? "https://www.pexels.com"} target="_blank" rel="noreferrer" className="underline">{lesson.image.source ?? "Pexels"}</a>
                  </p>
                )}
                {noVoice && <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}
                <button onClick={() => { stopVoice(); setStep(1); persist(1, scores); }}
                  className="mt-6 w-full rounded-2xl bg-indigo-700 py-4 text-sm font-semibold hover:bg-indigo-600">Continue</button>
              </div>
            ) : (
              sentence && (
                <>
                  <section className="mt-8 rounded-2xl bg-[#26262d] p-6">
                    <p className="text-sm font-semibold"><span className="text-white">{lesson.word}</span> <span className="text-white/60">- {lesson.translation}</span></p>
                    <hr className="mt-4 border-white/10" />
                    <p className="mt-5 text-xs font-semibold text-white/80">Read out loud</p>
                    <p className="mt-4 min-h-[56px] text-2xl font-semibold leading-snug" lang={lang}>
                      {result ? <ColoredSentence r={result} /> : sentence.sentence}
                    </p>
                    <div className="mt-6 flex items-center gap-2">
                      <button onClick={play} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ${speaking ? "animate-pulse text-indigo-300" : ""}`}><RotateCw size={13} /></span>
                        Replay
                      </button>
                      <button onClick={() => setExplain(true)} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"><Info size={13} /></span>
                        Explain
                      </button>
                    </div>
                  </section>

                  {prefs.showTranslation && (
                    <div className="mt-6 px-6">
                      <p className="text-xs font-semibold text-white/80">Translation</p>
                      <p className="mt-3 text-sm font-semibold">{sentence.translation}</p>
                    </div>
                  )}

                  <div className="px-6">
                    {noVoice && <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}
                    {!pron.canListen && <p className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Speech recognition isn&apos;t supported in this browser. Use Chrome or Edge to practise speaking.</p>}
                    <ErrorText text={pron.error} />
                  </div>

                  {result ? (
                    <Review r={result} last={step === n} onRetry={retry} onNext={() => go(scores)} />
                  ) : (
                    <div className="mt-auto flex flex-col items-center gap-2 pb-6 pt-10">
                      <p className="min-h-[20px] text-center text-sm text-white/60" aria-live="polite">
                        {pron.mic === "listening" ? (pron.live || "Listening… tap to stop") : pron.mic === "evaluating" ? "Checking your pronunciation…" : "Tap the mic and read the sentence"}
                      </p>
                      <button onClick={onMic} disabled={pron.mic === "evaluating" || !pron.canListen}
                        aria-label={pron.mic === "listening" ? "Stop recording" : "Start speaking"}
                        className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${pron.mic === "listening" ? "animate-pulse bg-red-500" : "bg-indigo-700 hover:bg-indigo-600"}`}>
                        {pron.mic === "evaluating" ? <Loader2 className="animate-spin" size={22} /> : pron.mic === "listening" ? <Square size={18} fill="white" /> : <Mic size={22} />}
                      </button>
                      <button onClick={skip} disabled={pron.mic !== "idle"} className="mt-2 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-40">Skip</button>
                    </div>
                  )}
                </>
              )
            )}
          </>
        )}
      </main>

      {explain && sentence && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setExplain(false)}>
          <div role="dialog" aria-label="Explanation" onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-[448px] overflow-y-auto rounded-3xl bg-[#1c1c22] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Explanation</h2>
              <button onClick={() => setExplain(false)} aria-label="Close" className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">🧑‍🏫</span>
              <span className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold">Let&apos;s analyze this sentence!</span>
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-white/40 bg-black/30 p-4">
              <p className="font-semibold" lang={lang}>{sentence.sentence}</p>
              <p className="mt-2 text-sm text-white/80">{sentence.translation}</p>
            </div>
            {sentence.chunks.length > 0 ? (
              sentence.chunks.map((c, i) => (
                <div key={i} className="mt-5">
                  <span className="inline-block rounded-lg bg-white/10 px-2.5 py-1 text-sm" lang={lang}>
                    <span className="font-semibold">{c.text}</span>{c.meaning && <span className="text-white/80"> - {c.meaning}</span>}
                  </span>
                  {c.explanation && <p className="mt-2 text-[13px] leading-relaxed text-white/80">{c.explanation}</p>}
                </div>
              ))
            ) : (
              <p className="mt-5 text-sm text-white/80">{sentence.note || "No extra notes for this sentence."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ lesson, scores, saved, saveError, hasNext, onNext, onAgain, onBack }: {
  lesson: WordLesson; scores: (number | null)[]; saved: Saved; saveError: string | null; hasNext: boolean;
  onNext: () => void; onAgain: () => void; onBack: () => void;
}) {
  const scored = scores.filter((s): s is number => s !== null);
  return (
    <div className="mx-auto mt-6 w-full max-w-xl">
      <div className="rounded-2xl bg-[#26262d] p-6 text-center">
        <p className="text-2xl font-semibold" lang="und">{lesson.word}</p>
        <p className="mt-1 text-sm text-white/60">{lesson.translation}</p>
        <div className="mt-5">
          {scored.length === 0 ? (
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
                  <h2 className="text-xl font-semibold">{saved.passed ? "Word learned!" : "Keep practising"}</h2>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <Stars n={Math.round(saved.average)} size={26} />
                    <span className="text-lg font-semibold">{saved.average.toFixed(1)}/5</span>
                  </div>
                  {!saved.passed && <p className="mt-2 text-sm text-white/60">You need an average of {PASS_SCORE}.0 to complete this word.</p>}
                </>
              )}
              <ErrorText text={saveError} />
            </>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {lesson.sentences.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-4 rounded-xl bg-[#26262d] px-4 py-3 text-sm">
            <span>{s.sentence}</span>
            {scores[i] != null ? <Stars n={scores[i] as number} size={14} /> : <span className="shrink-0 text-xs text-white/40">Skipped</span>}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3">
        {hasNext && <button onClick={onNext} className="rounded-xl bg-indigo-700 py-3 text-sm font-semibold hover:bg-indigo-600">Next word</button>}
        <div className="flex gap-3">
          <button onClick={onAgain} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Practise again</button>
          <button onClick={onBack} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Back to words</button>
        </div>
      </div>
    </div>
  );
}
