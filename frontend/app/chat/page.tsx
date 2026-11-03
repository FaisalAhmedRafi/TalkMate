"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Languages, Loader2, MessageCirclePlus, Mic, MoreVertical, RotateCw, Send, Settings, Square, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { useChat } from "@/components/chat/ChatProvider";
import { ChatSettings, HistoryModal, NewChatConfirm, TutorPicker } from "@/components/chat/ChatDialogs";
import { FeedbackEmpty, FeedbackList, ReviewBadge, type Review } from "@/components/roleplay/Feedback";
import { api, type ChatSaved, type Msg, type RoleplayFeedback } from "@/lib/api";
import { DEFAULT_PREFS, SPEEDS, loadChatPrefs, saveChatPrefs, tutorImg, type ChatPrefs } from "@/lib/chat";
import { SPEECH_LANG } from "@/lib/modes";
import { cancelSpeech, createRecognition, hasVoiceFor, speak } from "@/lib/speech";

// Keyed by the message's index in `msgs`
type Tr = { text?: string; loading?: boolean; open: boolean };
type Dialog = null | "history" | "tutor" | "confirm" | "settings";

const roundBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40";
const hasUser = (m: Msg[]) => m.some((x) => x.role === "user");

// Chat mode: free conversation with an AI tutor; the right panel reviews each of the learner's messages.
export default function ChatPage() {
  const router = useRouter();
  const { progress, updateSettings } = useChat();
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";

  const [tutor, setTutor] = useState(DEFAULT_PREFS.tutor);
  const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULT_PREFS);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [tr, setTr] = useState<Record<number, Tr>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null); // "m<i>" for a bubble, "r<i>" for a corrected line
  const [noVoice, setNoVoice] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // refs: the latest values for code that runs later (callbacks after a request, speech and mic events)
  const learnerRef = useRef(learner); learnerRef.current = learner;
  const prefsRef = useRef(prefs); prefsRef.current = prefs;
  const tutorRef = useRef(tutor); tutorRef.current = tutor;
  const snap = useRef({ msgs, reviews, tr, tutor }); snap.current = { msgs, reviews, tr, tutor };
  const switching = useRef(false); // true while the chat is being swapped, so a delayed save cannot write the old chat into the new one
  const sugVersion = useRef(0);
  const audioToken = useRef(0);
  const loadedLang = useRef<string | null>(null);
  const recRef = useRef<any>(null);
  const end = useRef<HTMLDivElement>(null);
  const panelEnd = useRef<HTMLDivElement>(null);

  const updatePrefs = (patch: Partial<ChatPrefs>) => setPrefs((p) => { const n = { ...p, ...patch }; saveChatPrefs(n); return n; });

  // ---- audio ----
  const stopAudio = useCallback(() => { audioToken.current++; cancelSpeech(); setSpeaking(null); }, []);
  const speakText = useCallback((id: string, t: string, after?: () => void) => {
    const tok = ++audioToken.current;
    setSpeaking(id);
    speak(t, lang, SPEEDS[prefsRef.current.speed], () => {
      setSpeaking((c) => (c === id ? null : c));
      if (after && audioToken.current === tok) after(); // not when the audio was cut off by something else
    });
  }, [lang]);

  // ---- suggestion bar ----
  const fetchSuggestions = useCallback((history: Msg[]) => {
    const v = ++sugVersion.current;
    setSuggestions([]);
    if (!prefsRef.current.suggestions) return;
    api.chat.suggestions({ ...learnerRef.current, tutor: tutorRef.current, messages: history.slice(-10) })
      .then((r) => { if (sugVersion.current === v) setSuggestions(r.suggestions); })
      .catch(() => {}); // no suggestions is fine
  }, []);

  // ---- microphone ----
  const sendRef = useRef<(t: string) => void>(() => {});
  const listen = () => {
    if (listening) return recRef.current?.stop();
    const rec = createRecognition(lang);
    if (!rec) return setError("Speech recognition isn't supported in this browser. Use Chrome or Edge, or type instead.");
    stopAudio(); setError(null);
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
  const listenRef = useRef(listen); listenRef.current = listen;

  /** After a tutor message: read it aloud (speaker on) and/or open the microphone (Auto microphone activation). */
  const afterTutor = useCallback((i: number, content: string) => {
    const auto = prefsRef.current.autoMic ? () => listenRef.current() : undefined;
    if (prefsRef.current.autoplay) speakText(`m${i}`, content, auto);
    else auto?.();
  }, [speakText]);

  // ---- loading / starting chats ----
  const resetChat = useCallback(() => {
    sugVersion.current++;
    stopAudio();
    recRef.current?.abort?.();
    setMsgs([]); setReviews({}); setTr({}); setSuggestions([]); setText(""); setError(null); setLoadError(null);
  }, [stopAudio]);

  const applySession = useCallback((s: ChatSaved) => {
    tutorRef.current = s.tutor; setTutor(s.tutor);
    setMsgs(s.messages);
    setReviews(Object.fromEntries(Object.entries(s.reviews).map(([k, data]) => [Number(k), { state: "done" as const, data }])));
    setTr(Object.fromEntries(Object.entries(s.translations).map(([k, t]) => [Number(k), { text: t, open: false }])));
    if (s.messages[s.messages.length - 1]?.role === "assistant") fetchSuggestions(s.messages);
  }, [fetchSuggestions]);

  /** A new chat: the tutor greets the learner. */
  const begin = useCallback(async () => {
    const { opening } = await api.chat.start({ ...learnerRef.current, tutor: tutorRef.current });
    const first: Msg[] = [{ role: "assistant", content: opening }];
    setMsgs(first);
    fetchSuggestions(first);
    setTimeout(() => afterTutor(0, opening), 450);
  }, [fetchSuggestions, afterTutor]);

  /** Continue the open chat, otherwise start a new one. */
  const load = useCallback(async () => {
    setLoading(true); resetChat();
    try {
      const { session } = await api.chat.session().catch(() => ({ session: null }));
      if (session) applySession(session);
      else await begin();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't start the chat");
    } finally {
      setLoading(false);
    }
  }, [resetChat, applySession, begin]);

  // first visit, and again whenever the target language changes (chats are kept per language)
  useEffect(() => {
    if (loadedLang.current === null) {
      const p = loadChatPrefs();
      prefsRef.current = p; tutorRef.current = p.tutor; setPrefs(p); setTutor(p.tutor);
    }
    if (loadedLang.current === progress.language) return;
    loadedLang.current = progress.language;
    load();
  }, [progress.language, load]);

  /** Saves the open chat now (the learner's first message creates it on the server). */
  const saveNow = useCallback(async () => {
    const s = snap.current;
    if (!hasUser(s.msgs)) return;
    const rv: Record<string, RoleplayFeedback> = {};
    for (const [k, r] of Object.entries(s.reviews)) if (r.state === "done") rv[k] = r.data;
    const tv: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.tr)) if (v.text) tv[k] = v.text; // lookups still running are left out
    await api.chat.save({ tutor: s.tutor, messages: s.msgs, reviews: rv, translations: tv }).catch(() => {}); // best effort
  }, []);

  // save after every change (not while the tutor is answering, so a half turn is never stored)
  useEffect(() => {
    if (loading || busy || !hasUser(msgs)) return;
    const t = setTimeout(() => { if (!switching.current) saveNow(); }, 800);
    return () => clearTimeout(t);
  }, [loading, busy, msgs, reviews, tr, tutor, saveNow]);

  // suggestion bar switched on or off in Settings
  useEffect(() => {
    if (!prefs.suggestions) { sugVersion.current++; setSuggestions([]); return; }
    const last = snap.current.msgs[snap.current.msgs.length - 1];
    if (last?.role === "assistant" && !loading) fetchSuggestions(snap.current.msgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.suggestions]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, suggestions]);
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
      const data = await api.chat.feedback({ ...learnerRef.current, message });
      setReviews((r) => ({ ...r, [i]: { state: "done", data } }));
    } catch (e) {
      setReviews((r) => ({ ...r, [i]: { state: "error", error: e instanceof Error ? e.message : "Couldn't check this message" } }));
    }
  }, []);

  // ---- sending ----
  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || busy || loading || msgs.length === 0) return;
    stopAudio();
    const i = msgs.length; // index of the learner's new message
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next); setText(""); setBusy(true); setError(null);
    sugVersion.current++; setSuggestions([]);
    review(i, t); // the tutor's answer and the review run in parallel
    try {
      const { reply } = await api.chat.reply({ ...learner, tutor, messages: next.slice(-20) });
      const all: Msg[] = [...next, { role: "assistant", content: reply }];
      setMsgs(all);
      fetchSuggestions(all);
      afterTutor(i + 1, reply);
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
  sendRef.current = send;

  // ---- translate button on the tutor's bubbles ----
  const toggleTranslate = async (i: number) => {
    const cur = tr[i];
    if (cur?.loading) return;
    if (cur?.text) return setTr((t) => ({ ...t, [i]: { ...cur, open: !cur.open } }));
    setTr((t) => ({ ...t, [i]: { loading: true, open: true } }));
    try {
      const { translation } = await api.chat.translate({ ...learner, text: msgs[i].content });
      setTr((t) => ({ ...t, [i]: { text: translation, open: true } }));
    } catch (e) {
      setTr((t) => { const n = { ...t }; delete n[i]; return n; });
      setError(e instanceof Error ? e.message : "Couldn't translate this message");
    }
  };

  // ---- menu actions ----
  /** Runs `job` while the chat is swapped; the old chat is saved first. */
  const swap = async (job: () => Promise<void>) => {
    switching.current = true;
    try {
      await saveNow();
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    } finally {
      switching.current = false;
    }
  };

  const newChat = () => {
    setDialog(null); setMenuOpen(false);
    return swap(async () => {
      if (hasUser(snap.current.msgs)) await api.chat.archive(); // the old chat goes to the history
      setLoading(true); resetChat();
      try { await begin(); } catch (e) { setLoadError(e instanceof Error ? e.message : "Couldn't start the chat"); }
      setLoading(false);
    });
  };
  // a chat with only the greeting has nothing to keep, so no question is asked
  const requestNewChat = () => { setMenuOpen(false); if (hasUser(msgs)) setDialog("confirm"); else newChat(); };

  const openHistory = (id: string) => {
    setDialog(null);
    return swap(async () => {
      const { session } = await api.chat.open(id);
      setLoading(true); resetChat();
      applySession(session);
      setLoading(false);
    });
  };

  const changeTutor = (id: string) => {
    setDialog(null);
    if (id === tutor) return;
    tutorRef.current = id; setTutor(id); updatePrefs({ tutor: id });
    // before the learner has written anything the new tutor simply says hello; later the chat goes on with the new tutor
    if (!hasUser(msgs)) {
      setLoading(true); resetChat();
      begin().catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't start the chat")).finally(() => setLoading(false));
    }
  };

  const changeSettings = async (patch: { language?: string; nativeLanguage?: string; level?: string }) => {
    if (patch.language && patch.language !== progress.language) {
      // keep the chat in the old language before switching
      switching.current = true;
      try { await saveNow(); await updateSettings(patch); } finally { switching.current = false; }
    } else {
      await updateSettings(patch);
    }
  };

  const close = () => { cancelSpeech(); router.push("/dashboard"); };

  const userCount = msgs.filter((m) => m.role === "user").length;
  const lastIsTutor = msgs[msgs.length - 1]?.role === "assistant";

  const panel = (
    <FeedbackList msgs={msgs} reviews={reviews} speaking={speaking} lang={lang} learnerLang={progress.nativeLanguage}
      onSpeak={(id, t) => speakText(id, t)} onRetry={(i) => review(i, msgs[i].content)} end={panelEnd} />
  );

  const menuItem = "flex w-full items-start gap-5 px-6 py-5 text-left transition-colors hover:bg-white/5";
  const items = [
    { icon: MessageCirclePlus, title: "Start a new chat", sub: "End the current chat and start a new one.", act: requestNewChat, accent: false },
    { icon: History, title: "See chat history", sub: "You can view and manage your previous conversations.", act: () => { setMenuOpen(false); setDialog("history"); }, accent: false },
    { icon: UserRound, title: "Change AI tutor", sub: "You can pick a different personal AI tutor.", act: () => { setMenuOpen(false); setDialog("tutor"); }, accent: true },
    { icon: Settings, title: "Settings", sub: "Manage your chat settings.", act: () => { setMenuOpen(false); setDialog("settings"); }, accent: false },
  ];

  return (
    <div className="flex h-screen flex-col bg-[#222228]">
      <header className="relative flex shrink-0 items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">Chat</h1>
        <button onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5"><X size={16} /></button>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* chat */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#1f1f27]">
          <div className="relative flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tutorImg(tutor)} alt="" className="h-10 w-10 rounded-full bg-[#f7f7fc] object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1f1f27] bg-green-500" />
              </div>
              <span className="text-sm font-semibold">{tutor}</span>
            </div>
            <div className="flex items-center gap-5 text-white/90">
              <button onClick={() => { updatePrefs({ autoplay: !prefs.autoplay }); stopAudio(); }}
                aria-label={prefs.autoplay ? "Turn off automatic audio" : "Turn on automatic audio"} className="hover:text-white">
                {prefs.autoplay ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
              <button onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? "Close menu" : "More options"} aria-expanded={menuOpen} className="relative z-30 hover:text-white">
                {menuOpen ? <X size={22} /> : <MoreVertical size={22} />}
              </button>
            </div>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-3 top-3 z-20 w-[min(430px,calc(100%-24px))] overflow-hidden rounded-3xl border border-white/10 bg-[#25252d] pt-12 shadow-2xl">
                  <ul className="divide-y divide-white/10 px-0">
                    {items.map(({ icon: Icon, title, sub, act, accent }) => (
                      <li key={title}>
                        <button onClick={act} className={`${menuItem} ${accent ? "text-indigo-300" : ""}`}>
                          <Icon size={24} className="mt-1 shrink-0" />
                          <span>
                            <span className="block text-lg font-semibold">{title}</span>
                            <span className={`mt-1 block text-sm ${accent ? "font-semibold text-indigo-300" : "text-white/60"}`}>{sub}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
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
            ) : loading ? (
              <div className="flex flex-col items-center gap-3 py-16 text-white/70">
                <Loader2 className="animate-spin" />
                <p className="text-sm">{tutor} is getting ready…</p>
              </div>
            ) : (
              msgs.map((m, i) => m.role === "assistant" ? (
                <div key={i} className="flex items-start gap-3">
                  <div className="max-w-[80%] rounded-3xl bg-white/5 px-5 py-3 text-sm font-medium leading-relaxed">
                    <p className="whitespace-pre-wrap" lang={lang}>{m.content}</p>
                    {tr[i]?.open && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-xs text-white/70">
                        {tr[i].loading ? <span className="inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Translating…</span> : tr[i].text}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => speakText(`m${i}`, m.content)} aria-label="Replay this message" className={`${roundBtn} ${speaking === `m${i}` ? "animate-pulse" : ""}`}><RotateCw size={14} /></button>
                    <button onClick={() => toggleTranslate(i)} aria-label="Translate this message" className={`${roundBtn} ${tr[i]?.open ? "bg-indigo-600 hover:bg-indigo-500" : ""}`}><Languages size={14} /></button>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-end gap-1">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-indigo-600 px-5 py-3 text-sm font-medium leading-relaxed" lang={lang}>{m.content}</div>
                  <ReviewBadge r={reviews[i]} onOpen={() => { if (!window.matchMedia("(min-width: 1024px)").matches) setFeedbackOpen(true); }} />
                </div>
              ))
            )}
            {busy && <div className="w-fit rounded-3xl bg-white/5 px-5 py-3 text-sm text-white/60">{tutor} is typing…</div>}

            {/* suggestion bar */}
            {!loading && !busy && !loadError && lastIsTutor && prefs.suggestions && suggestions.length > 0 && (
              <div className="flex flex-col items-end gap-3 pt-3">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} lang={lang}
                    className="rounded-full border border-white/80 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/10">{s}</button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>

          <div className="shrink-0 px-5 pb-3">
            {noVoice && <p className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}
            <ErrorText text={error} />
            <div className="mt-3 flex items-center gap-3">
              <input
                value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)}
                readOnly={listening} disabled={loading || msgs.length === 0} lang={lang} aria-label="Your message"
                placeholder={listening ? "Listening… tap the square to stop" : "Aa"}
                className="h-14 min-w-0 flex-1 rounded-full border border-white/20 bg-transparent px-6 text-sm outline-none placeholder:text-white/50 focus:border-indigo-500 disabled:opacity-50"
              />
              {text.trim() && !listening ? (
                <button onClick={() => send(text)} disabled={busy} aria-label="Send"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"><Send size={20} /></button>
              ) : (
                <button onClick={listen} disabled={busy || loading || msgs.length === 0} aria-label={listening ? "Stop recording" : "Speak"}
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${listening ? "animate-pulse bg-red-500" : "bg-[#43455a] hover:bg-[#51546b]"}`}>
                  {listening ? <Square size={18} fill="white" /> : <Mic size={22} />}
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[10px] text-white/50">You&apos;re talking to AI. Check important info.</p>
          </div>
        </section>

        {/* feedback on the learner's messages (a modal below lg) */}
        <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col rounded-2xl border border-white/10 bg-[#1f1f27] lg:flex">
          {userCount === 0 ? <FeedbackEmpty /> : panel}
        </aside>
      </main>

      {dialog === "history" && <HistoryModal onOpen={openHistory} onNew={() => { setDialog(null); requestNewChat(); }} onClose={() => setDialog(null)} />}
      {dialog === "tutor" && <TutorPicker current={tutor} onSave={changeTutor} onClose={() => setDialog(null)} />}
      {dialog === "confirm" && <NewChatConfirm onYes={newChat} onCancel={() => setDialog(null)} />}
      {dialog === "settings" && <ChatSettings progress={progress} prefs={prefs} onPrefs={updatePrefs} onSettings={changeSettings} onClose={() => setDialog(null)} />}
      {feedbackOpen && (
        <Modal label="Message feedback" onClose={() => setFeedbackOpen(false)} wide>
          <h2 className="text-lg font-semibold">Message feedback</h2>
          <div className="mt-3 flex max-h-[65vh] min-h-[200px] flex-col">{userCount === 0 ? <FeedbackEmpty /> : panel}</div>
        </Modal>
      )}
    </div>
  );
}
