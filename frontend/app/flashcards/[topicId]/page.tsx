"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, Loader2, Settings, Volume2, VolumeX, X } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { Logo } from "@/components/sentence/SentenceShell";
import { useFlashcards } from "@/components/flashcards/FlashcardsProvider";
import { api, type FlashCard, type FlashDeck, type FlashStatus } from "@/lib/api";
import { useTopicId } from "@/lib/flashcards";
import { SPEECH_LANG } from "@/lib/modes";
import { loadPrefs, savePrefs, type SentencePrefs } from "@/lib/sentence";
import { cancelSpeech, hasVoiceFor, speak } from "@/lib/speech";

const keyOf = (c: FlashCard) => `${c.topicId}:${c.index}`;
// A topic deck starts with the cards not known yet (all of them when everything is known); the Daily review is every card it holds.
const buildQueue = (d: FlashDeck, review: boolean) => {
  if (review) return d.cards;
  const todo = d.cards.filter((c) => c.status !== "known");
  return todo.length ? todo : d.cards;
};

// One flashcard deck, full screen: a photo, the word, its sound and an example sentence, then "Learning" or "I know it".
export default function FlashcardDeckPage() {
  const topicId = useTopicId();
  const router = useRouter();
  const { progress } = useFlashcards();
  const review = topicId === "review";
  const learner = { targetLanguage: progress.language, nativeLanguage: progress.nativeLanguage, level: progress.level };
  const lang = SPEECH_LANG[progress.language] ?? "en-US";

  const [deck, setDeck] = useState<FlashDeck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [queue, setQueue] = useState<FlashCard[]>([]);
  const [pos, setPos] = useState(0);
  const [session, setSession] = useState<Record<string, FlashStatus>>({}); // what the learner chose in this run
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [prefs, setPrefs] = useState<SentencePrefs>({ autoplay: true, slow: false, showTranslation: true });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const startedFor = useRef<string | null>(null);
  const rewarded = useRef(false); // +10 XP once per visit, not for every extra practice round

  const n = queue.length;
  const card: FlashCard | undefined = queue[pos];
  const updatePrefs = (patch: Partial<SentencePrefs>) => setPrefs((p) => { const x = { ...p, ...patch }; savePrefs(x); return x; });
  const stopVoice = useCallback(() => { cancelSpeech(); setSpeaking(false); }, []);

  const load = useCallback(async (restart: boolean) => {
    setLoadError(null); setDeck(null); setQueue([]); setPos(0); setSession({}); setFlags({}); setSummary(false); rewarded.current = false;
    try {
      const d = review ? await api.flashcards.review() : await api.flashcards.deck(topicId, { ...learner, restart });
      setDeck(d);
      setQueue(buildQueue(d, review));
      setFlags(Object.fromEntries(d.cards.map((c) => [keyOf(c), c.flagged])));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't open the flashcards");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, review, progress.language, progress.nativeLanguage, progress.level]);

  useEffect(() => {
    if (startedFor.current === topicId) return;
    const first = startedFor.current === null;
    startedFor.current = topicId;
    if (first) setPrefs(loadPrefs());
    load(false);
  }, [topicId, load]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () => setNoVoice(!hasVoiceFor(lang));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, [lang]);

  const say = useCallback((text: string) => {
    if (!text) return;
    setSpeaking(true);
    speak(text, lang, prefs.slow ? 0.6 : 0.95, () => setSpeaking(false));
  }, [lang, prefs.slow]);
  const sayRef = useRef(say);
  sayRef.current = say;

  // read each new word aloud
  useEffect(() => {
    setImgFailed(false);
    if (!card || summary || !prefs.autoplay) return;
    const t = setTimeout(() => sayRef.current(card.term), 350);
    return () => { clearTimeout(t); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.topicId, card?.index, summary, prefs.autoplay]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  const finish = (sess: Record<string, FlashStatus>) => {
    stopVoice();
    setSummary(true);
    if (rewarded.current) return;
    rewarded.current = true;
    const known = queue.filter((c) => sess[keyOf(c)] === "known").length;
    api.flashcards.complete({ topicId, known, total: queue.length }).catch(() => {}); // the XP is a bonus; never block the summary on it
  };

  // "Learning" or "I know it": saved at once, then on to the next card
  const answer = (status: "learning" | "known") => {
    if (!card) return;
    const next = { ...session, [keyOf(card)]: status };
    setSession(next);
    api.flashcards.mark({ topicId: card.topicId, language: progress.language, index: card.index, status }).catch(() => {}); // best effort
    if (status === "known") setFlags((f) => ({ ...f, [keyOf(card)]: false })); // the server clears the flag too
    stopVoice();
    if (pos < n - 1) setPos(pos + 1);
    else finish(next);
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  useEffect(() => {
    if (!card || summary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") answerRef.current("learning");
      else if (e.key === "ArrowRight") answerRef.current("known");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, summary]);

  const toggleFlag = () => {
    if (!card) return;
    const k = keyOf(card);
    const value = !flags[k];
    setFlags((f) => ({ ...f, [k]: value }));
    api.flashcards.mark({ topicId: card.topicId, language: progress.language, index: card.index, flagged: value }).catch(() => setFlags((f) => ({ ...f, [k]: !value })));
  };

  const practiseLearning = () => {
    const again = queue.filter((c) => session[keyOf(c)] === "learning");
    setQueue(again); setPos(0); setSession({}); setSummary(false);
  };
  const newWords = () => {
    if (window.confirm("Replace this deck with 15 new words? Your marks for this topic will be reset.")) load(true);
  };
  const close = () => { stopVoice(); router.push("/flashcards"); };

  const pct = n ? ((pos + 1) / n) * 100 : 0;
  const knownNow = queue.filter((c) => session[keyOf(c)] === "known").length;
  const learningNow = queue.filter((c) => session[keyOf(c)] === "learning");

  return (
    <div className="flex min-h-screen flex-col bg-[#222228]">
      <header className="relative flex items-center justify-between border-b border-white/5 bg-[#1c1c22] px-5 py-4">
        <Logo />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold">{deck?.title ?? "Flashcards"}</h1>
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
              <button onClick={() => load(false)} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500">Try again</button>
              <button onClick={close} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Back</button>
            </div>
          </div>
        ) : !deck ? (
          <div className="m-auto flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="animate-spin" />
            <p className="text-sm">{review ? "Gathering your cards…" : "Getting your flashcards ready…"}</p>
          </div>
        ) : n === 0 ? (
          <div className="m-auto max-w-sm text-center">
            <h2 className="text-xl font-semibold">Nothing to review yet</h2>
            <p className="mt-2 text-sm text-white/60">Cards you mark &quot;Learning&quot; or flag in a topic will show up here.</p>
            <button onClick={close} className="mt-6 rounded-xl bg-indigo-700 px-6 py-3 text-sm font-semibold hover:bg-indigo-600">Back to flashcards</button>
          </div>
        ) : summary ? (
          <div className="mx-auto mt-6 w-full max-w-xl">
            <div className="rounded-2xl bg-[#26262d] p-6 text-center">
              <h2 className="text-xl font-semibold">{learningNow.length === 0 ? "All done!" : "Nice work!"}</h2>
              <p className="mt-3 text-3xl font-semibold">{knownNow}<span className="text-white/40">/{n}</span></p>
              <p className="mt-1 text-sm text-white/60">cards you know</p>
            </div>
            {learningNow.length > 0 && (
              <ul className="mt-4 space-y-2">
                {learningNow.map((c) => (
                  <li key={keyOf(c)} className="flex items-center justify-between gap-4 rounded-xl bg-[#26262d] px-4 py-3 text-sm">
                    <span className="font-semibold" lang={lang}>{c.term}</span>
                    <span className="text-white/60">{c.translation}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-col gap-3">
              {learningNow.length > 0 && <button onClick={practiseLearning} className="rounded-xl bg-indigo-700 py-3 text-sm font-semibold hover:bg-indigo-600">Practise the {learningNow.length} learning card{learningNow.length > 1 ? "s" : ""}</button>}
              <div className="flex gap-3">
                {!review && <button onClick={newWords} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">New words</button>}
                <button onClick={close} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Back to flashcards</button>
              </div>
            </div>
          </div>
        ) : card && (
          <>
            {/* progress: the bar fills as you go and the bubble shows where you are */}
            <div className="relative mt-2 h-8" aria-label={`Card ${pos + 1} of ${n}`}>
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-300/60" />
              <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-700 transition-all" style={{ width: `${pct}%` }} />
              <span className="absolute top-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black transition-all"
                style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}>
                {pos + 1}<span className="font-normal text-black/50"> / {n}</span>
              </span>
            </div>

            <div className="relative mt-4 flex justify-center">
              <button onClick={toggleFlag} aria-pressed={!!flags[keyOf(card)]} aria-label={flags[keyOf(card)] ? "Remove flag" : "Flag this card for the Daily review"}
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <Flag size={16} className={flags[keyOf(card)] ? "fill-amber-400 text-amber-400" : "text-white/80"} />
              </button>

              <div className="relative mt-3 w-full max-w-[328px]">
                <div className="absolute inset-x-6 -top-2 h-4 rounded-t-3xl border border-white/5 bg-[#1a1a20]" aria-hidden="true" />
                <div className="relative rounded-3xl border border-white/10 bg-[#1c1c22] p-8 text-center">
                  {card.image && !imgFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image.url} alt="" onError={() => setImgFailed(true)} className="mx-auto h-[202px] w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="mx-auto flex h-[202px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-7xl">{deck.emoji}</div>
                  )}
                  <h2 className="mt-6 text-xl font-semibold" lang={lang}>{card.term}</h2>
                  {prefs.showTranslation && <p className="mt-1 text-sm text-white/60">{card.translation}</p>}
                  <button onClick={() => say(card.term)} aria-label="Play the word"
                    className={`mx-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 ${speaking ? "animate-pulse text-indigo-300" : ""}`}>
                    <Volume2 size={14} />
                  </button>
                  {card.example && (
                    <button onClick={() => say(card.example)} aria-label="Play the example sentence" className="mt-5 block w-full text-center">
                      <span className="block text-[13px] font-semibold leading-snug" lang={lang}>{card.example}</span>
                      {prefs.showTranslation && card.exampleTranslation && <span className="mt-1 block text-xs font-normal text-white/50">{card.exampleTranslation}</span>}
                    </button>
                  )}
                </div>
                {card.image && !imgFailed && (
                  <p className="mt-2 text-center text-[11px] text-white/40">
                    Photo by <a href={card.image.creditUrl} target="_blank" rel="noreferrer" className="underline">{card.image.credit}</a> on{" "}
                    <a href={card.image.sourceUrl ?? "https://www.pexels.com"} target="_blank" rel="noreferrer" className="underline">{card.image.source ?? "Pexels"}</a>
                  </p>
                )}
              </div>
            </div>
            {noVoice && <p className="mx-auto mt-4 max-w-[328px] rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">Your browser has no {progress.language} voice installed, so the audio may not play.</p>}

            <div className="mt-auto flex justify-center gap-4 pb-6 pt-10">
              <button onClick={() => answer("learning")}
                className="flex h-16 w-[196px] items-center justify-center gap-2 rounded-2xl border border-white/20 text-xs font-semibold hover:bg-white/5">
                <X size={14} className="text-orange-400" /> Learning
              </button>
              <button onClick={() => answer("known")}
                className="flex h-16 w-[196px] items-center justify-center gap-2 rounded-2xl border border-white/20 text-xs font-semibold hover:bg-white/5">
                <Check size={14} className="text-green-400" /> I know it
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
