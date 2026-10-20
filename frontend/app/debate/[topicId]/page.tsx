"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useDebate } from "@/components/debate/DebateProvider";
import type { DebateSide } from "@/lib/api";
import { DEBATE_INTRO, useDebateId } from "@/lib/debate";

// Step 2: the picture of the chosen topic, the statement and the two sides.
export default function DebateTopicPage() {
  const topicId = useDebateId();
  const router = useRouter();
  const { topics, topicsError, progress } = useDebate();
  const topic = topics?.topics.find((t) => t.id === topicId);

  useEffect(() => {
    if (topics && !topic) router.replace("/debate"); // unknown topic id
  }, [topics, topic, router]);

  // a side with a saved debate is continued; "Start over" tells the chat to throw the saved one away
  const choose = (side: DebateSide, restart = false) => router.push(`/debate/${topicId}/practice?side=${side}${restart ? "&restart=1" : ""}`);
  const saved = (side: DebateSide) => topic?.saved[side] ?? 0;

  return (
    <SentenceShell title="Debates" backHref="/debate">
      <p className="mt-3 text-[13px] text-white/80">{DEBATE_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      {topicsError ? (
        <p className="mt-8 text-white/60">{topicsError}</p>
      ) : !topic ? (
        <p className="mt-8 text-white/60">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#1c1c24] p-4 sm:flex-row">
          <div className="h-64 shrink-0 overflow-hidden rounded-xl sm:h-[412px] sm:w-[310px]">
            {topic.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={topic.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-7xl">{topic.emoji}</div>
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <h1 className="text-lg font-semibold">{topic.title}</h1>
            <p className="mt-3 text-[13px] text-white/80">{topic.statement}</p>
            <p className="mt-3 text-xs text-white/50">{progress.language} · {progress.level} · Feedback in {progress.nativeLanguage}</p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-auto">
              {(["for", "against"] as const).map((side) => (
                <div key={side}>
                  <button onClick={() => choose(side)} className="w-full rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold hover:bg-indigo-600">
                    {saved(side) > 0 ? `Continue arguing ${side}` : `Argue ${side}`}
                  </button>
                  {saved(side) > 0 && (
                    <p className="mt-1.5 text-center text-[11px] text-white/50">
                      {saved(side)} {saved(side) === 1 ? "message" : "messages"} saved ·{" "}
                      <button onClick={() => choose(side, true)} className="font-semibold underline hover:text-white">Start over</button>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SentenceShell>
  );
}
