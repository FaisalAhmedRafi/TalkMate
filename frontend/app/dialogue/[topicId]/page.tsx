"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useDialogue } from "@/components/dialogue/DialogueProvider";
import { DIALOGUE_INTRO, dialogueKey, useDialogueId } from "@/lib/dialogue";

// Step 2: the picture of the chosen topic, a short description and Start.
export default function DialogueTopicPage() {
  const topicId = useDialogueId();
  const router = useRouter();
  const { topics, topicsError, progress } = useDialogue();
  const topic = topics?.topics.find((t) => t.id === topicId);

  useEffect(() => {
    if (topics && !topic) router.replace("/dialogue"); // unknown topic id
  }, [topics, topic, router]);

  const start = () => {
    // Start always begins at the first line, not wherever an earlier visit stopped
    try { sessionStorage.removeItem(dialogueKey(topicId, progress.language, progress.level, progress.nativeLanguage)); } catch {}
    router.push(`/dialogue/${topicId}/practice`);
  };

  return (
    <SentenceShell title="Dialogue Mode" backHref="/dialogue">
      <p className="mt-3 text-[13px] text-white/80">{DIALOGUE_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      {topicsError ? (
        <p className="mt-8 text-white/60">{topicsError}</p>
      ) : !topic ? (
        <p className="mt-8 text-white/60">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#1c1c24] p-4 sm:flex-row">
          <div className="h-56 shrink-0 overflow-hidden rounded-xl sm:h-[206px] sm:w-[206px]">
            {topic.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={topic.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-7xl">{topic.emoji}</div>
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <h1 className="text-lg font-semibold">{topic.title}</h1>
            <p className="mt-2 text-[13px] text-white/80">
              Practice with a pre-scripted conversation. Record and read your part of the dialogue out loud.
            </p>
            <p className="mt-3 text-xs text-white/50">
              {progress.language} · {progress.level} · with a {topic.partner.toLowerCase()} · Translations in {progress.nativeLanguage}
              {topic.attempts > 0 && ` · Best ${topic.bestScore.toFixed(1)}/5`}
            </p>
            <button onClick={start} className="mt-6 rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold hover:bg-indigo-600 sm:mt-auto">
              Start
            </button>
          </div>
        </div>
      )}
    </SentenceShell>
  );
}
