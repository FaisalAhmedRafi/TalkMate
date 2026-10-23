"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Info, Languages, Loader2, Mic, MoreVertical, RotateCw, Sparkles, Speech, Square, X } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { useCall } from "@/components/call/CallProvider";
import { api, type CallAdvanced, type CallFeedback, type Msg } from "@/lib/api";
import { loadPrefs, savePrefs, type SentencePrefs } from "@/lib/sentence";
import { SPEECH_LANG } from "@/lib/modes";
import { cancelSpeech, createRecognition, hasVoiceFor, speak } from "@/lib/speech";

// Reviews are keyed by the message's index in `msgs`
type Review = { state: "loading" } | { state: "error"; error: string } | { state: "done"; data: CallFeedback };
type Adv = { state: "loading" } | { state: "error"; error: string } | { state: "done"; data: CallAdvanced };
type Tr = { text?: string; loading?: boolean };

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const ctrl = "flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40";
const KAI_IMG = "/call/kai.svg"; // replace this file with a portrait of your own (same path)

// Call Mode: an audio-only phone call with the teacher (Kai). The right panel reviews what the learner said.
export default function CallPage() {
  const router = useRouter();
  const { progress } = useCall();
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [tr, setTr] = useState<Record<number, Tr>>({});
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState(""); // live transcript while the mic is open
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false); // Kai is talking
  const [hearing, setHearing] = useState<string | null>(null); // "r<i>" while a corrected line is read aloud
  const [voiceOn, setVoiceOn] = useState(true); // the first control: Kai's voice
  const [captionOn, setCaptionOn] = useState(false); // the translate control: Kai's last line + its translation
  const [noVoice, setNoVoice] = useState(false);
  const [prefs, setPrefs] = useState<SentencePrefs>({ autoplay: true, slow: false, showTranslation: true });
  const [seconds, setSeconds] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [adv, setAdv] = useState<Adv | null>(null);
  const started = useRef(false);
  const callStart = useRef(0);
  const recRef = useRef<any>(null);
  const panelEnd = useRef<HTMLDivElement>(null);

  const updatePrefs = (patch: Partial<SentencePrefs>) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });

  const say = useCallback((t: string) => {
    setSpeaking(true);
    speak(t, lang, prefs.slow ? 0.6 : 0.95, () => setSpeaking(false));
  }, [lang, prefs.slow]);
  const sayRef = useRef(say);
  sayRef.current = say;
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  // ---- connect: Kai picks up and says the first line ----
  const connect = useCallback(async () => {
    cancelSpeech(); setSpeaking(false);
    setLoadError(null); setConnected(false); setMsgs([]); setReviews({}); setTr({}); setError(null); setAdv(null); setSeconds(0);
    try {
      const s = await api.call.start(learner);
      setMsgs([{ role: "assistant", content: s.opening }]);
      setConnected(true);
      callStart.current = Date.now();
      if (voiceRef.current) setTimeout(() => sayRef.current(s.opening), 400);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't start the call");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.language, progress.level, progress.nativeLanguage]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setPrefs(loadPrefs());
    connect();
  }, [connect]);

  // the call timer
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - callStart.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [connected]);

  useEffect(() => { panelEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [reviews, heard, listening]);

  // warn when the browser has no voice for this language
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setNoVoice(!hasVoiceFor(lang));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [lang]);

  useEffect(() => () => { cancelSpeech(); recRef.current?.abort?.(); }, []);

  // ---- review of one spoken message ----
  const review = useCallback(async (i: number, message: string) => {
    setReviews((r) => ({ ...r, [i]: { state: "loading" } }));
    try {
      const data = await api.call.feedback({ ...learner, message });
      setReviews((r) => ({ ...r, [i]: { state: "done", data } }));
    } catch (e) {
      setReviews((r) => ({ ...r, [i]: { state: "error", error: e instanceof Error ? e.message : "Couldn't check this message" } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.language, progress.level, progress.nativeLanguage]);

  // ---- sending what the learner said ----
  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || busy || !connected) return;
    cancelSpeech(); setSpeaking(false);
    const i = msgs.length; // index of the learner's new message
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next); setBusy(true); setError(null);
    review(i, t); // Kai's answer and the review run in parallel
    try {
      const { reply } = await api.call.reply({ ...learner, messages: next.slice(-20) });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      if (voiceRef.current) sayRef.current(reply);
    } catch (e) {
      // take the message back so the learner can say it again
      setMsgs((m) => m.slice(0, i));
      setReviews((r) => { const n = { ...r }; delete n[i]; return n; });
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  const listen = () => {
    if (listening) return recRef.current?.stop();
    const rec = createRecognition(lang);
    if (!rec) return setError("Speech recognition isn't supported in this browser. Use Chrome or Edge.");
    cancelSpeech(); setSpeaking(false); setHearing(null); setError(null); setHeard("");
    let text = "";
    rec.onresult = (e: any) => {
      let s = "";
      for (let k = 0; k < e.results.length; k++) s += e.results[k][0].transcript + " ";
      text = s.trim();
      setHeard(text); // shown live in the panel
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setError("The browser blocked the microphone. Allow it for this site and try again.");
      else if (e?.error === "no-speech") setError("I didn't hear anything. Tap the mic and try again.");
    };
    rec.onend = () => { setListening(false); setHeard(""); recRef.current = null; if (text) sendRef.current(text); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  // ---- the translate control: Kai's last line and its translation ----
  const lastKai = (() => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "assistant") return i; return -1; })();
  const translateLast = useCallback(async (i: number) => {
    if (i < 0 || tr[i]?.text || tr[i]?.loading) return;
    setTr((t) => ({ ...t, [i]: { loading: true } }));
    try {
      const { translation } = await api.call.translate({ ...learner, text: msgs[i].content });
      setTr((t) => ({ ...t, [i]: { text: translation } }));
    } catch (e) {
      setTr((t) => { const n = { ...t }; delete n[i]; return n; });
      setCaptionOn(false);
      setError(e instanceof Error ? e.message : "Couldn't translate this message");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, msgs, progress.language, progress.level, progress.nativeLanguage]);
  useEffect(() => { if (captionOn) translateLast(lastKai); }, [captionOn, lastKai, translateLast]);

  const toggleVoice = () => {
    if (voiceOn) { cancelSpeech(); setSpeaking(false); }
    setVoiceOn((v) => !v);
  };
  const replay = () => { if (lastKai >= 0) say(msgs[lastKai].content); };

  // ---- advanced feedback on the whole call ----
  const advanced = async () => {
    setAdv({ state: "loading" });
    try {
      const data = await api.call.advanced({ ...learner, messages: msgs.slice(-30) });
      setAdv({ state: "done", data });
    } catch (e) {
      setAdv({ state: "error", error: e instanceof Error ? e.message : "Couldn't get your feedback" });
    }
  };

  const restart = () => {
    setMenuOpen(false);
    if (msgs.length > 1 && !window.confirm("Start a new call? The conversation so far will be cleared.")) return;
    recRef.current?.abort?.();
    connect();
  };
  const close = () => { cancelSpeech(); recRef.current?.abort?.(); router.push("/dashboard"); };

  const userCount = msgs.filter((m) => m.role === "user").length;
  const captionVisible = (captionOn || !voiceOn) && lastKai >= 0;
  const status = !connected ? "Connecting…" : listening ? "Listening…" : busy ? "Kai is thinking…" : null;

  const panel = (
    <ReviewList msgs={msgs} reviews={reviews} hearing={hearing} lang={lang}
      onSpeak={(i, t) => { setHearing(`r${i}`); speak(t, lang, prefs.slow ? 0.6 : 0.95, () => setHearing((c) => (c === `r${i}` ? null : c))); }}
      onRetry={(i) => review(i, msgs[i].content)} />
  );
  const live = listening && (
    <div className="mx-4 mb-4 rounded-xl border border-dashed border-white/15 bg-black/40 px-4 py-4 text-sm font-semibold text-white/70" lang={lang}>
      {heard || "Listening…"}
    </div>
  );
  const advancedButton = (
    <div className="shrink-0 p-4 pt-2">
      <button onClick={() => { advanced(); }} disabled={userCount === 0 || adv?.state === "loading"}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-semibold text-indigo-200 transition-colors hover:bg-white/5 disabled:opacity-40">
        <Sparkles size={16} /> Advanced feedback
      </button>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-[#222228]">
      <header className="relative flex shrink-0 items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Call Mode</h1>
        <button onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* the call */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#1f1f27]">
          <div className="relative mx-5 flex shrink-0 items-center justify-between border-b border-white/5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={KAI_IMG} alt="" className="h-9 w-9 rounded-full bg-slate-700 object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1f1f27] bg-green-500" />
              </div>
              <span className="text-sm font-semibold">Kai</span>
            </div>
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" className="text-white/90 hover:text-white"><MoreVertical size={20} /></button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-20 w-60 rounded-xl border border-white/10 bg-[#26262d] p-2 text-sm shadow-xl">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5">
                    Slow speech
                    <input type="checkbox" checked={prefs.slow} onChange={(e) => updatePrefs({ slow: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
                  </label>
                  <button onClick={() => { setMenuOpen(false); setFeedbackOpen(true); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5 lg:hidden">Message feedback</button>
                  <button onClick={restart} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">Start a new call</button>
                  <button onClick={close} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">End call</button>
                </div>
              </>
            )}
          </div>

          <button onClick={() => setInfoOpen(true)} aria-label="About Call Mode"
            className="absolute right-5 top-[76px] flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-400">
            <Info size={14} />
          </button>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
            {loadError ? (
              <div className="py-10">
                <ErrorText text={loadError} />
                <div className="mt-4 flex justify-center gap-3">
                  <button onClick={connect} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
                  <button onClick={close} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back</button>
                </div>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={KAI_IMG} alt="Kai" className={`h-32 w-32 rounded-full bg-slate-700 object-cover ${speaking ? "ring-4 ring-indigo-500/60 ring-offset-4 ring-offset-[#1f1f27]" : ""}`} />
                <p className="mt-5 text-xl font-semibold">Kai</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{fmt(seconds)}</p>
                <p className="mt-2 h-5 text-xs text-white/60" aria-live="polite">
                  {status && <span className="inline-flex items-center gap-1.5">{!listening && <Loader2 size={12} className="animate-spin" />}{status}</span>}
                </p>
                {captionVisible && (
                  <div className="mt-4 max-w-md rounded-xl bg-white/5 px-4 py-3 text-left text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap font-medium" lang={lang}>{msgs[lastKai].content}</p>
                    {captionOn && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-xs text-white/70">
                        {tr[lastKai]?.text ?? <span className="inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Translating…</span>}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="shrink-0 px-5 pb-6">
            {noVoice && <p className="mx-auto mb-3 max-w-md rounded-lg bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-200">Your browser has no {progress.language} voice installed, so Kai may not be heard.</p>}
            {error && <div className="mx-auto max-w-md"><ErrorText text={error} /></div>}
            <div className="mt-4 flex justify-center">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#15151b] p-2">
                <button onClick={toggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? "Turn off Kai's voice" : "Turn on Kai's voice"}
                  className={`${ctrl} ${voiceOn ? "bg-white/15" : ""}`}><Speech size={18} /></button>
                <button onClick={() => setCaptionOn((v) => !v)} aria-pressed={captionOn} disabled={!connected} aria-label="Show Kai's words with a translation"
                  className={`${ctrl} ${captionOn ? "bg-white/15" : ""}`}><Languages size={18} /></button>
                <button onClick={replay} disabled={lastKai < 0} aria-label="Hear Kai's last line again"
                  className={`${ctrl} ${speaking ? "animate-pulse" : ""}`}><RotateCw size={18} /></button>
                <button onClick={listen} disabled={busy || !connected} aria-label={listening ? "Stop recording" : "Speak"}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors disabled:opacity-50 ${listening ? "animate-pulse bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"}`}>
                  {listening ? <Square size={16} fill="white" /> : <Mic size={20} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* what the learner said, with corrections (a modal below lg) */}
        <aside className="hidden min-h-0 w-[330px] shrink-0 flex-col rounded-2xl border border-white/10 bg-[#1f1f27] lg:flex">
          {userCount === 0 && !listening ? <FeedbackEmpty /> : <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{panel}{live}<div ref={panelEnd} /></div>}
          {advancedButton}
        </aside>
      </main>

      {infoOpen && (
        <Modal label="About Call Mode" onClose={() => setInfoOpen(false)}>
          <h2 className="text-lg font-semibold">Call Mode</h2>
          <p className="mt-2 text-sm text-white/80">An audio-only phone call with Kai, your {progress.language} teacher. Tap the mic, say something, tap it again (or just pause) and Kai answers out loud.</p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/70">
            <li>• The panel on the right shows what you said, with a correction when it can be better.</li>
            <li>• Use the translate button to see Kai&apos;s words and their {progress.nativeLanguage} translation.</li>
            <li>• The loop button plays Kai&apos;s last line again. Slow speech is in the ⋮ menu.</li>
            <li>• Speech recognition works in Chrome and Edge.</li>
          </ul>
          <p className="mt-3 text-xs text-white/50">{progress.language} · {progress.level} · Feedback in {progress.nativeLanguage}</p>
        </Modal>
      )}
      {feedbackOpen && (
        <Modal label="Message feedback" onClose={() => setFeedbackOpen(false)} wide>
          <h2 className="text-lg font-semibold">Message feedback</h2>
          <div className="mt-3 flex max-h-[65vh] min-h-[200px] flex-col overflow-y-auto">{userCount === 0 ? <FeedbackEmpty /> : panel}</div>
          <button onClick={() => { setFeedbackOpen(false); advanced(); }} disabled={userCount === 0}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-semibold text-indigo-200 hover:bg-white/5 disabled:opacity-40">
            <Sparkles size={16} /> Advanced feedback
          </button>
        </Modal>
      )}
      {adv && (
        <Modal label="Advanced feedback" onClose={() => setAdv(null)} wide>
          <h2 className="text-lg font-semibold">Advanced feedback</h2>
          <AdvancedBody adv={adv} lang={lang} onRetry={advanced} />
        </Modal>
      )}
    </div>
  );
}

/** Shown until the learner has said something: what the panel will do. */
function FeedbackEmpty() {
  return (
    <div className="m-auto flex flex-col items-center px-6 text-center">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white"><Check size={14} strokeWidth={3} /></span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white"><X size={13} /></span>
      </div>
      <p className="mt-6 text-sm font-semibold">Get feedback on what you say</p>
      <p className="mt-2 text-xs text-white/70">Tap the mic and speak. AI will check each thing you say and show you how to say it better.</p>
    </div>
  );
}

/** One block per thing the learner said: the words, then the wrong and the corrected line and a short explanation. */
function ReviewList({ msgs, reviews, hearing, lang, onSpeak, onRetry }: {
  msgs: Msg[]; reviews: Record<number, Review>; hearing: string | null; lang: string;
  onSpeak: (i: number, text: string) => void; onRetry: (i: number) => void;
}) {
  return (
    <div className="space-y-6 p-4">
      {msgs.map((m, i) => {
        const r = reviews[i];
        if (m.role !== "user" || !r) return null;
        const d = r.state === "done" ? r.data : null;
        const fixed = d && !d.correct && d.corrected ? d.corrected : null;
        return (
          <article key={i}>
            <div className="rounded-xl border border-dashed border-white/15 bg-black/40 px-4 py-4 text-sm font-semibold" lang={lang}>{m.content}</div>
            {r.state === "loading" && <p className="mt-4 flex items-center gap-2 text-xs text-white/60"><Loader2 size={14} className="animate-spin" /> Checking…</p>}
            {r.state === "error" && (
              <div className="mt-4">
                <p className="text-xs text-red-300">{r.error}</p>
                <button onClick={() => onRetry(i)} className="mt-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20">Try again</button>
              </div>
            )}
            {d && (
              <>
                {!d.correct && (
                  <div className="mt-4 flex w-fit max-w-full items-start gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white/70" lang={lang}>
                    <X size={14} className="mt-1 shrink-0" strokeWidth={3} /> <span>{m.content}</span>
                  </div>
                )}
                {fixed ? (
                  <button onClick={() => onSpeak(i, fixed)} aria-label="Hear the corrected sentence"
                    className={`mt-2 flex w-fit max-w-full items-start gap-2 rounded-md bg-green-600 px-2.5 py-1 text-left text-sm font-semibold ${hearing === `r${i}` ? "animate-pulse" : ""}`} lang={lang}>
                    <Check size={14} className="mt-1 shrink-0" strokeWidth={3} /> <span>{fixed}</span>
                  </button>
                ) : d.correct ? (
                  <div className="mt-4 flex w-fit max-w-full items-start gap-2 rounded-md bg-green-600 px-2.5 py-1 text-sm font-semibold" lang={lang}>
                    <Check size={14} className="mt-1 shrink-0" strokeWidth={3} /> <span>{m.content}</span>
                  </div>
                ) : (
                  <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-400"><AlertTriangle size={14} /> Can be improved</p>
                )}
                {d.explanation && <p className="mt-3 text-xs leading-relaxed text-white/80">{d.explanation}</p>}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function AdvancedBody({ adv, lang, onRetry }: { adv: Adv; lang: string; onRetry: () => void }) {
  if (adv.state === "loading") {
    return <p className="mt-6 flex items-center gap-2 py-6 text-sm text-white/70"><Loader2 size={16} className="animate-spin" /> Reviewing your call…</p>;
  }
  if (adv.state === "error") {
    return (
      <div className="mt-3">
        <ErrorText text={adv.error} />
        <button onClick={onRetry} className="mt-4 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
      </div>
    );
  }
  const d = adv.data;
  const h = "mt-5 text-xs font-semibold uppercase tracking-wide text-white/50";
  return (
    <div className="mt-2 text-sm">
      <p className="leading-relaxed text-white/90">{d.summary}</p>
      {d.strengths.length > 0 && (
        <>
          <h3 className={h}>What went well</h3>
          <ul className="mt-2 space-y-1.5">
            {d.strengths.map((s, i) => <li key={i} className="flex gap-2 text-white/80"><Check size={14} className="mt-1 shrink-0 text-green-400" strokeWidth={3} /> {s}</li>)}
          </ul>
        </>
      )}
      {d.mistakes.length > 0 && (
        <>
          <h3 className={h}>To fix</h3>
          <div className="mt-2 space-y-3">
            {d.mistakes.map((m, i) => (
              <div key={i} className="rounded-xl bg-[#26262d] p-3">
                <p className="flex items-start gap-2 text-white/60" lang={lang}><X size={14} className="mt-1 shrink-0" strokeWidth={3} /> {m.original}</p>
                <p className="mt-1 flex items-start gap-2 font-semibold text-green-300" lang={lang}><Check size={14} className="mt-1 shrink-0" strokeWidth={3} /> {m.corrected}</p>
                {m.explanation && <p className="mt-2 text-xs text-white/70">{m.explanation}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {d.tips.length > 0 && (
        <>
          <h3 className={h}>Practise next</h3>
          <ul className="mt-2 space-y-1.5">
            {d.tips.map((t, i) => <li key={i} className="flex gap-2 text-white/80"><Sparkles size={14} className="mt-1 shrink-0 text-indigo-300" /> {t}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
