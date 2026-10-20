"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, Info, Languages, Loader2, Mic, MoreVertical, RotateCw, Send, Square, User, Volume2, VolumeX, X,
} from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { useDebate } from "@/components/debate/DebateProvider";
import { api, type DebateFeedback, type DebateSide, type DebateStart, type Msg } from "@/lib/api";
import { debateKey, useDebateId } from "@/lib/debate";
import { loadPrefs, savePrefs, type SentencePrefs } from "@/lib/sentence";
import { SPEECH_LANG } from "@/lib/modes";
import { cancelSpeech, createRecognition, hasVoiceFor, speak } from "@/lib/speech";

// Both maps are keyed by the message's index in `msgs`
type Review = { state: "loading" } | { state: "error"; error: string } | { state: "done"; data: DebateFeedback };
type Tr = { text?: string; loading?: boolean; open: boolean };

const roundBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40";

// Step 3: the debate. The teacher (Kai) argues the other side; the right panel reviews each of the learner's messages.
export default function DebatePracticePage() {
  const topicId = useDebateId();
  const router = useRouter();
  const { progress } = useDebate();
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";

  const [side, setSide] = useState<DebateSide | null>(null);
  const [intro, setIntro] = useState<DebateStart | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [tr, setTr] = useState<Record<number, Tr>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null); // "m<i>" for a bubble, "r<i>" for a corrected line
  const [noVoice, setNoVoice] = useState(false);
  const [prefs, setPrefs] = useState<SentencePrefs>({ autoplay: true, slow: false, showTranslation: true });
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const started = useRef(false);
  const recRef = useRef<any>(null);
  const end = useRef<HTMLDivElement>(null);
  const panelEnd = useRef<HTMLDivElement>(null);

  const updatePrefs = (patch: Partial<SentencePrefs>) => setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });
  const key = side ? debateKey(topicId, side, progress.language, progress.level, progress.nativeLanguage) : "";

  // the side comes from ?side=for|against (set by the intro page)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("side");
    if (s === "for" || s === "against") setSide(s);
    else router.replace(`/debate/${topicId}`);
  }, [topicId, router]);

  const speakText = useCallback((id: string, t: string) => {
    setSpeaking(id);
    speak(t, lang, prefs.slow ? 0.6 : 0.95, () => setSpeaking((c) => (c === id ? null : c)));
  }, [lang, prefs.slow]);
  const speakRef = useRef(speakText);
  speakRef.current = speakText;
  const autoplayRef = useRef(prefs.autoplay);
  autoplayRef.current = prefs.autoplay;

  // ---- load: restore an unfinished debate, otherwise ask the teacher to open it ----
  const load = useCallback(async () => {
    if (!side) return;
    setLoadError(null); setIntro(null); setMsgs([]); setReviews({}); setTr({}); setError(null); setText("");
    try {
      const s = await api.debate.start(topicId, side, learner);
      setIntro(s); setMsgs([{ role: "assistant", content: s.opening }]);
      if (autoplayRef.current) setTimeout(() => speakRef.current("m0", s.opening), 450);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't start the debate");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, side, progress.language, progress.level, progress.nativeLanguage]);

  useEffect(() => {
    if (!side || started.current) return;
    started.current = true;
    setPrefs(loadPrefs());
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.intro && Array.isArray(s.msgs) && s.msgs.length) {
          setIntro(s.intro); setMsgs(s.msgs); setReviews(s.reviews ?? {}); setTr(s.tr ?? {});
          return;
        }
      }
    } catch {}
    load();
  }, [side, key, load]);

  // keep the debate across refreshes; unfinished lookups are not saved (they would stay "loading" forever)
  useEffect(() => {
    if (!intro || !key) return;
    const done = <T extends { state?: string; loading?: boolean }>(o: Record<number, T>, ok: (v: T) => boolean) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => ok(v)));
    try {
      sessionStorage.setItem(key, JSON.stringify({
        intro, msgs,
        reviews: done(reviews, (r) => r.state === "done"),
        tr: done(tr, (t) => !t.loading),
      }));
    } catch {}
  }, [intro, msgs, reviews, tr, key]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { panelEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [reviews]);

  // warn when the browser has no voice for this language
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setNoVoice(!hasVoiceFor(lang));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [lang]);

  useEffect(() => () => { cancelSpeech(); recRef.current?.abort?.(); }, []);

  // ---- review of one learner message ----
  const review = useCallback(async (i: number, message: string) => {
    setReviews((r) => ({ ...r, [i]: { state: "loading" } }));
    try {
      const data = await api.debate.feedback({ ...learner, message });
      setReviews((r) => ({ ...r, [i]: { state: "done", data } }));
    } catch (e) {
      setReviews((r) => ({ ...r, [i]: { state: "error", error: e instanceof Error ? e.message : "Couldn't check this message" } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.language, progress.level, progress.nativeLanguage]);

  // ---- sending ----
  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || busy || !intro || !side) return;
    cancelSpeech(); setSpeaking(null);
    const i = msgs.length; // index of the learner's new message
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next); setText(""); setBusy(true); setError(null);
    review(i, t); // the teacher's answer and the review run in parallel
    try {
      const { reply } = await api.debate.reply({ ...learner, topicId, side, messages: next.slice(-20) });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      if (autoplayRef.current) speakRef.current(`m${i + 1}`, reply);
    } catch (e) {
      // take the message back so it can be sent again
      setMsgs((m) => m.slice(0, i));
      setReviews((r) => { const n = { ...r }; delete n[i]; return n; });
      setText(t);
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
    if (!rec) return setError("Speech recognition isn't supported in this browser. Use Chrome or Edge, or type instead.");
    cancelSpeech(); setSpeaking(null); setError(null);
    let heard = "";
    rec.onresult = (e: any) => {
      let s = "";
      for (let k = 0; k < e.results.length; k++) s += e.results[k][0].transcript + " ";
      heard = s.trim();
      setText(heard); // shown live in the input
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setError("The browser blocked the microphone. Allow it for this site and try again.");
      else if (e?.error === "no-speech") setError("I didn't hear anything. Tap the mic and try again.");
    };
    rec.onend = () => { setListening(false); recRef.current = null; if (heard) sendRef.current(heard); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  // ---- translate button on the teacher's bubbles ----
  const toggleTranslate = async (i: number) => {
    const cur = tr[i];
    if (cur?.loading) return;
    if (cur?.text) return setTr((t) => ({ ...t, [i]: { ...cur, open: !cur.open } }));
    setTr((t) => ({ ...t, [i]: { loading: true, open: true } }));
    try {
      const { translation } = await api.debate.translate({ ...learner, text: msgs[i].content });
      setTr((t) => ({ ...t, [i]: { text: translation, open: true } }));
    } catch (e) {
      setTr((t) => { const n = { ...t }; delete n[i]; return n; });
      setError(e instanceof Error ? e.message : "Couldn't translate this message");
    }
  };

  const restart = () => {
    setMenuOpen(false);
    if (msgs.length > 1 && !window.confirm("Start this debate over? The conversation so far will be cleared.")) return;
    cancelSpeech(); setSpeaking(null);
    try { sessionStorage.removeItem(key); } catch {}
    load();
  };
  const close = () => { cancelSpeech(); router.push(`/debate/${topicId}`); };

  const userCount = msgs.filter((m) => m.role === "user").length;

  const panel = (
    <FeedbackList msgs={msgs} reviews={reviews} speaking={speaking} lang={lang} learnerLang={progress.nativeLanguage}
      onSpeak={speakText} onRetry={(i) => review(i, msgs[i].content)} end={panelEnd} />
  );

  return (
    <div className="flex h-screen flex-col bg-[#222228]">
      <header className="relative flex shrink-0 items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Debates</h1>
        <button onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* chat */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#1f1f27]">
          <div className="relative flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-lg">{intro?.teacher.emoji ?? "🧑‍🏫"}</div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1f1f27] bg-green-500" />
              </div>
              <span className="text-sm font-semibold">{intro?.teacher.name ?? "Kai"}</span>
            </div>
            <div className="flex items-center gap-5 text-white/90">
              <button onClick={() => setInfoOpen(true)} aria-label="About this debate" className="hover:text-white"><Info size={20} /></button>
              <button onClick={() => { updatePrefs({ autoplay: !prefs.autoplay }); cancelSpeech(); setSpeaking(null); }}
                aria-label={prefs.autoplay ? "Turn off automatic audio" : "Turn on automatic audio"} className="hover:text-white">
                {prefs.autoplay ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" className="hover:text-white"><MoreVertical size={20} /></button>
            </div>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-4 top-14 z-20 w-60 rounded-xl border border-white/10 bg-[#26262d] p-2 text-sm shadow-xl">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5">
                    Slow speech
                    <input type="checkbox" checked={prefs.slow} onChange={(e) => updatePrefs({ slow: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
                  </label>
                  <button onClick={() => { setMenuOpen(false); setFeedbackOpen(true); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5 lg:hidden">Message feedback</button>
                  <button onClick={restart} disabled={!intro} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5 disabled:opacity-40">Restart debate</button>
                  <button onClick={close} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">Change topic or side</button>
                </div>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
            {loadError ? (
              <div className="m-auto py-16 text-center">
                <ErrorText text={loadError} />
                <div className="mt-4 flex justify-center gap-3">
                  <button onClick={() => load()} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
                  <button onClick={close} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back</button>
                </div>
              </div>
            ) : !intro ? (
              <div className="flex flex-col items-center gap-3 py-16 text-white/70">
                <Loader2 className="animate-spin" />
                <p className="text-sm">Kai is getting ready…</p>
              </div>
            ) : (
              msgs.map((m, i) => m.role === "assistant" ? (
                <div key={i} className="flex items-start gap-3">
                  <div className="max-w-[80%] rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium leading-relaxed">
                    <p className="whitespace-pre-wrap" lang={lang}>{m.content}</p>
                    {tr[i]?.open && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-xs text-white/70">
                        {tr[i].loading ? <span className="inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Translating…</span> : tr[i].text}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => speakText(`m${i}`, m.content)} aria-label="Replay this message" className={`${roundBtn} ${speaking === `m${i}` ? "animate-pulse" : ""}`}><RotateCw size={14} /></button>
                    <button onClick={() => toggleTranslate(i)} aria-label="Translate this message" className={`${roundBtn} ${tr[i]?.open ? "bg-indigo-600 hover:bg-indigo-500" : ""}`}><Languages size={14} /></button>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-end gap-1">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium leading-relaxed" lang={lang}>{m.content}</div>
                  <ReviewBadge r={reviews[i]} onOpen={() => { if (!window.matchMedia("(min-width: 1024px)").matches) setFeedbackOpen(true); }} />
                </div>
              ))
            )}
            {busy && <div className="w-fit rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/60">Kai is typing…</div>}
            <div ref={end} />
          </div>

          <div className="shrink-0 px-5 pb-5">
            {noVoice && <p className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}
            <ErrorText text={error} />
            <div className="mt-3 flex items-center gap-3">
              <input
                value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)}
                readOnly={listening} disabled={!intro} lang={lang} aria-label="Your message"
                placeholder={listening ? "Listening… tap the square to stop" : "Aa"}
                className="h-14 min-w-0 flex-1 rounded-full border border-white/20 bg-transparent px-6 text-sm outline-none placeholder:text-white/50 focus:border-indigo-500 disabled:opacity-50"
              />
              {text.trim() && !listening ? (
                <button onClick={() => send(text)} disabled={busy} aria-label="Send"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"><Send size={20} /></button>
              ) : (
                <button onClick={listen} disabled={busy || !intro} aria-label={listening ? "Stop recording" : "Speak"}
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${listening ? "animate-pulse bg-red-500" : "bg-white/15 hover:bg-white/25"}`}>
                  {listening ? <Square size={18} fill="white" /> : <Mic size={22} />}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* feedback on the learner's messages (a modal below lg) */}
        <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col rounded-2xl border border-white/10 bg-[#1f1f27] lg:flex">
          {userCount === 0 ? <FeedbackEmpty /> : panel}
        </aside>
      </main>

      {infoOpen && (
        <Modal label="About this debate" onClose={() => setInfoOpen(false)}>
          <h2 className="text-lg font-semibold">{intro?.title ?? "Debate"}</h2>
          <p className="mt-2 text-sm text-white/80">{intro?.statement}</p>
          <p className="mt-4 text-sm text-white/70">
            You argue <span className="font-semibold text-white">{side}</span> this statement. {intro?.teacher.name ?? "Kai"} argues {side === "for" ? "against" : "for"} it.
          </p>
          <p className="mt-2 text-xs text-white/50">{progress.language} · {progress.level} · Feedback in {progress.nativeLanguage}</p>
        </Modal>
      )}
      {feedbackOpen && (
        <Modal label="Message feedback" onClose={() => setFeedbackOpen(false)} wide>
          <h2 className="text-lg font-semibold">Message feedback</h2>
          <div className="mt-3 flex max-h-[65vh] min-h-[200px] flex-col">{userCount === 0 ? <FeedbackEmpty /> : panel}</div>
        </Modal>
      )}
    </div>
  );
}

/** The small status under a learner's bubble: checking, correct or needs a fix. */
function ReviewBadge({ r, onOpen }: { r?: Review; onOpen: () => void }) {
  if (!r) return null;
  const base = "flex items-center gap-1 text-[11px] font-medium";
  return (
    <button onClick={onOpen} className="text-left" aria-label="Open the feedback for this message">
      {r.state === "loading" ? <span className={`${base} text-white/50`}><Loader2 size={12} className="animate-spin" /> Checking…</span>
        : r.state === "error" ? <span className={`${base} text-white/50`}><AlertTriangle size={12} /> Couldn&apos;t check</span>
        : r.data.correct ? <span className={`${base} text-green-400`}><Check size={12} strokeWidth={3} /> Correct</span>
        : <span className={`${base} text-amber-400`}><AlertTriangle size={12} /> Can be improved</span>}
    </button>
  );
}

/** Shown until the learner has sent a message: what the panel will do. */
function FeedbackEmpty() {
  const dot = "flex h-6 w-6 items-center justify-center rounded-full text-white";
  return (
    <div className="m-auto flex flex-col items-center px-6 text-center">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 px-5 py-3">
        <span className={`${dot} bg-green-600`}><Check size={14} strokeWidth={3} /></span>
        <span className={`${dot} bg-amber-500`}><AlertTriangle size={13} /></span>
        <span className={`${dot} bg-white/15`}><Languages size={13} /></span>
        <span className={`${dot} bg-white/15`}><User size={13} /></span>
      </div>
      <p className="mt-6 text-sm font-semibold">Get feedback on messages</p>
      <p className="mt-2 text-xs text-white/70">AI will assess your messages and give you personalized feedback.</p>
    </div>
  );
}

function FeedbackList({ msgs, reviews, speaking, lang, learnerLang, onSpeak, onRetry, end }: {
  msgs: Msg[]; reviews: Record<number, Review>; speaking: string | null; lang: string; learnerLang: string;
  onSpeak: (id: string, text: string) => void; onRetry: (i: number) => void; end: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {msgs.map((m, i) => {
        const r = reviews[i];
        if (m.role !== "user" || !r) return null;
        const d = r.state === "done" ? r.data : null;
        const say = d && !d.correct && d.corrected ? d.corrected : m.content; // hear the fixed line when there is one
        return (
          <article key={i} className="rounded-xl bg-[#26262d] p-4 text-sm">
            <p className="text-white/70" lang={lang}>“{m.content}”</p>
            {r.state === "loading" && <p className="mt-3 flex items-center gap-2 text-xs text-white/60"><Loader2 size={14} className="animate-spin" /> Checking your message…</p>}
            {r.state === "error" && (
              <div className="mt-3">
                <p className="text-xs text-red-300">{r.error}</p>
                <button onClick={() => onRetry(i)} className="mt-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20">Try again</button>
              </div>
            )}
            {d && (
              <>
                <p className={`mt-3 flex items-center gap-2 text-xs font-semibold ${d.correct ? "text-green-400" : "text-amber-400"}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${d.correct ? "bg-green-600" : "bg-amber-500"}`}>
                    {d.correct ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={11} />}
                  </span>
                  {d.correct ? "Correct" : "Can be improved"}
                </p>
                {!d.correct && d.corrected && (
                  <p className="mt-2 rounded-lg bg-green-500/10 px-3 py-2 text-green-200" lang={lang}>{d.corrected}</p>
                )}
                {d.explanation && <p className="mt-2 text-white/80">{d.explanation}</p>}
                {d.translation && (
                  <p className="mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-xs text-white/60">
                    <Languages size={14} className="mt-0.5 shrink-0" aria-label={`Translation in ${learnerLang}`} /> {d.translation}
                  </p>
                )}
                <button onClick={() => onSpeak(`r${i}`, say)} aria-label="Hear this sentence"
                  className={`mt-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 ${speaking === `r${i}` ? "animate-pulse" : ""}`}>
                  <Volume2 size={14} /> Listen
                </button>
              </>
            )}
          </article>
        );
      })}
      <div ref={end} />
    </div>
  );
}
