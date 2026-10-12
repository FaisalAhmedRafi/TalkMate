"use client";
import { useState } from "react";
import { ErrorText, Modal } from "./Modal";
import { api, type GenerateType, type Learner } from "@/lib/api";

const DEFAULT_TOPIC: Record<GenerateType, string> = {
  sentence: "greetings and introductions",
  word: "food and drinks",
  dialogue: "buying a train ticket",
  flashcards: "travel essentials",
};

export function GeneratePanel({ type, title, learner, onPractice, onClose }: {
  type: GenerateType; title: string; learner: Learner; onPractice: (text: string) => void; onClose: () => void;
}) {
  const [topic, setTopic] = useState(DEFAULT_TOPIC[type]);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const run = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true); setError(null); setData(null); setCard(0); setFlipped(false);
    try {
      setData(await api.generate({ ...learner, type, topic: topic.trim() }));
      onPractice(`Studied ${title.toLowerCase()}: ${topic.trim()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const items: any[] = data?.items ?? [];

  return (
    <Modal onClose={onClose} label={title} wide>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-white/60">{learner.targetLanguage} · {learner.level}</p>

      <div className="mt-4 flex gap-2">
        <input
          value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          aria-label="Topic" placeholder="Topic"
          className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={run} disabled={busy} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
          {busy ? "Generating…" : data ? "Regenerate" : "Generate"}
        </button>
      </div>
      <ErrorText text={error} />

      {type === "sentence" && items.length > 0 && (
        <ul className="mt-4 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl bg-white/5 p-3 text-sm">
              <p className="font-semibold">{it.sentence}</p>
              <p className="text-white/70">{it.translation}</p>
              {it.note && <p className="mt-1 text-xs text-white/50">{it.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {type === "word" && items.length > 0 && (
        <ul className="mt-4 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl bg-white/5 p-3 text-sm">
              <p><span className="font-semibold">{it.word}</span> <span className="text-white/60">· {it.translation}</span></p>
              <p className="mt-1 text-white/80">{it.example}</p>
              <p className="text-xs text-white/50">{it.exampleTranslation}</p>
            </li>
          ))}
        </ul>
      )}

      {type === "dialogue" && data?.lines?.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.title && <p className="font-semibold">{data.title}</p>}
          {data.lines.map((l: any, i: number) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${l.speaker === "A" ? "bg-white/10" : "ml-auto bg-indigo-600"}`}>
              <p>{l.text}</p>
              <p className="text-xs text-white/60">{l.translation}</p>
            </div>
          ))}
        </div>
      )}

      {type === "flashcards" && items.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setFlipped((f) => !f)} aria-label="Flip card"
            className="flex h-44 w-full flex-col items-center justify-center rounded-2xl bg-white/5 p-4 text-center transition-colors hover:bg-white/10"
          >
            <span className="text-2xl font-semibold">{flipped ? items[card].back : items[card].front}</span>
            {!flipped && items[card].hint && <span className="mt-2 text-xs text-white/50">Hint: {items[card].hint}</span>}
            <span className="mt-3 text-xs text-white/40">{flipped ? "Tap to see the word" : "Tap to reveal"}</span>
          </button>
          <div className="mt-3 flex items-center justify-between text-sm">
            <button disabled={card === 0} onClick={() => { setCard(card - 1); setFlipped(false); }} className="rounded-full bg-white/10 px-4 py-2 disabled:opacity-40">Previous</button>
            <span className="text-white/60">{card + 1} / {items.length}</span>
            <button disabled={card === items.length - 1} onClick={() => { setCard(card + 1); setFlipped(false); }} className="rounded-full bg-white/10 px-4 py-2 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
