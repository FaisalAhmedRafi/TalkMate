"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { ErrorText, Modal, Select } from "./Modal";
import { api, type ChatMode, type Learner, type Msg } from "@/lib/api";
import { SPEECH_LANG } from "@/lib/modes";

const SCENARIOS = ["Ordering at a restaurant", "Checking into a hotel", "Asking for directions", "A job interview", "Shopping for clothes"];
const CHARACTERS = ["Cleopatra", "Sherlock Holmes", "Albert Einstein", "Leonardo da Vinci"];
const TOPICS = ["Should homework be banned?", "Is remote work better than office work?", "Should cities ban cars downtown?"];

export function ChatPanel({ mode, title, learner, onPractice, onClose }: {
  mode: ChatMode; title: string; learner: Learner; onPractice: (text: string) => void; onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [character, setCharacter] = useState(CHARACTERS[0]);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [stance, setStance] = useState("for");
  const end = useRef<HTMLDivElement>(null);

  const ctxKey = mode === "roleplay" ? scenario : mode === "characters" ? character : mode === "debate" ? topic + stance : "";
  const context = useMemo(() => ({ scenario, character, topic, stance }), [scenario, character, topic, stance]);

  useEffect(() => { setMsgs([]); setError(null); }, [ctxKey]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = (s: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(s);
    u.lang = SPEECH_LANG[learner.targetLanguage] ?? "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next); setText(""); setBusy(true); setError(null);
    try {
      const { reply } = await api.chat({ ...learner, mode, messages: next.slice(-20), context });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      onPractice(t);
      if (mode === "call") speak(reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setError("Speech recognition isn't supported in this browser. Try Chrome, or type instead.");
    const r = new SR();
    r.lang = SPEECH_LANG[learner.targetLanguage] ?? "en-US";
    r.onresult = (e: any) => send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  };

  return (
    <Modal onClose={onClose} label={title} wide>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-white/60">{learner.targetLanguage} · {learner.level}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "roleplay" && <Select label="Scenario" value={scenario} onChange={setScenario} options={SCENARIOS} />}
        {mode === "characters" && <Select label="Character" value={character} onChange={setCharacter} options={CHARACTERS} />}
        {mode === "debate" && (
          <>
            <Select label="Topic" value={topic} onChange={setTopic} options={TOPICS} />
            <Select label="Your side" value={stance} onChange={setStance} options={["for", "against"]} />
          </>
        )}
      </div>

      <div className="mt-4 h-72 space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <p className="text-sm text-white/50">
            {mode === "call" ? "Tap the mic and start speaking." : `Say something in ${learner.targetLanguage} to begin.`}
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "ml-auto bg-indigo-600" : "bg-white/10"}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="w-fit rounded-2xl bg-white/10 px-4 py-2 text-sm text-white/60">Typing…</div>}
        <div ref={end} />
      </div>
      <ErrorText text={error} />

      <div className="mt-4 flex gap-2">
        {mode === "call" && (
          <button onClick={listen} disabled={busy || listening} aria-label="Speak"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${listening ? "animate-pulse bg-pink-500" : "bg-white/10 hover:bg-white/20"}`}>
            <Mic size={16} />
          </button>
        )}
        <input
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)}
          placeholder="Type a message"
          className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={() => send(text)} disabled={busy} aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">
          <Send size={16} />
        </button>
      </div>
    </Modal>
  );
}
