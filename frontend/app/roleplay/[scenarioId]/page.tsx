"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SentenceShell } from "@/components/sentence/SentenceShell";
import { useRoleplay } from "@/components/roleplay/RoleplayProvider";
import { ROLEPLAY_INTRO, useRoleplayId } from "@/lib/roleplay";

// Step 2: the picture of the chosen scenario, what happens in it, the three tasks and Start.
export default function RoleplayScenarioPage() {
  const scenarioId = useRoleplayId();
  const router = useRouter();
  const { scenarios, scenariosError } = useRoleplay();
  const scenario = scenarios?.scenarios.find((s) => s.id === scenarioId);

  useEffect(() => {
    if (scenarios && !scenario) router.replace("/roleplay"); // unknown scenario id
  }, [scenarios, scenario, router]);

  // an unfinished chat is continued; "Start over" tells the chat to throw the saved one away
  const start = (restart = false) => router.push(`/roleplay/${scenarioId}/practice${restart ? "?restart=1" : ""}`);
  const saved = scenario?.saved ?? 0;

  return (
    <SentenceShell title="Roleplays" backHref="/roleplay">
      <p className="mt-3 text-[13px] text-white/80">{ROLEPLAY_INTRO}</p>
      <hr className="mt-4 border-white/10" />

      {scenariosError ? (
        <p className="mt-8 text-white/60">{scenariosError}</p>
      ) : !scenario ? (
        <p className="mt-8 text-white/60">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#1c1c24] p-4 sm:flex-row">
          <div className="h-64 shrink-0 overflow-hidden rounded-xl sm:h-[412px] sm:w-[310px]">
            {scenario.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={scenario.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-7xl">{scenario.emoji}</div>
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <h1 className="text-lg font-semibold">{scenario.title}</h1>
            <p className="mt-3 text-[13px] text-white/90"><span className="font-semibold text-white">Scenario:</span> {scenario.scenario}</p>
            <p className="mt-4 text-[13px] font-semibold">Your tasks:</p>
            <ul className="mt-2 space-y-2 text-[13px] text-white/90">
              {scenario.tasks.map((t) => (
                <li key={t} className="flex gap-2"><span aria-hidden="true">•</span><span>{t}</span></li>
              ))}
            </ul>
            <div className="mt-6 sm:mt-auto">
              <button onClick={() => start()} className="w-full rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold hover:bg-indigo-600">
                {saved > 0 ? "Continue" : "Start"}
              </button>
              {saved > 0 && (
                <p className="mt-1.5 text-center text-[11px] text-white/50">
                  {saved} {saved === 1 ? "message" : "messages"} saved ·{" "}
                  <button onClick={() => start(true)} className="font-semibold underline hover:text-white">Start over</button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </SentenceShell>
  );
}
