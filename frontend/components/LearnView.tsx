"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronDown } from "lucide-react";
import { Modal } from "@/components/Modal";
import { tileOf } from "@/components/CoursesView";
import { api, type DialogueTopicInfo, type SentenceSkill, type WordStar } from "@/lib/api";
import { COURSES, COURSE_GROUPS, pathFor, titleize, type Course, type Unit } from "@/lib/courses";

type Step = { n: 1 | 2 | 3; mode: "Word Mode" | "Sentence Mode" | "Dialogue Mode"; href: string; emoji: string; cover?: string | null; title: string; done: boolean };

/** Learn: the learning path of the selected course. Each unit is three exercises (Word, Sentence and Dialogue Mode). */
export function LearnView({ course, premium, onSelectCourse, onLocked }: {
  course: Course; premium: boolean; onSelectCourse: (c: Course) => void; onLocked: (mode: string) => void;
}) {
  const [words, setWords] = useState<Record<string, WordStar>>({});
  const [skills, setSkills] = useState<Record<string, SentenceSkill>>({});
  const [topics, setTopics] = useState<Record<string, DialogueTopicInfo>>({});
  const [picker, setPicker] = useState(false);
  const [guide, setGuide] = useState<number | null>(null); // index of the unit whose book button is open
  const pickerRef = useRef<HTMLDivElement>(null);

  // Check marks come from the progress already saved in the three modes. A mode that fails to load just shows no check marks.
  useEffect(() => {
    let live = true;
    Promise.allSettled([api.word.units(), api.sentence.units(), api.dialogue.topics()]).then(([w, s, d]) => {
      if (!live) return;
      if (w.status === "fulfilled") setWords(Object.fromEntries(w.value.units.flatMap((x) => x.words).map((x) => [x.id, x])));
      if (s.status === "fulfilled") setSkills(Object.fromEntries(s.value.units.flatMap((x) => x.skills).map((x) => [x.id, x])));
      if (d.status === "fulfilled") setTopics(Object.fromEntries(d.value.topics.map((x) => [x.id, x])));
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!picker) return;
    const off = (e: MouseEvent) => { if (!pickerRef.current?.contains(e.target as Node)) setPicker(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(false); };
    document.addEventListener("mousedown", off); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); window.removeEventListener("keydown", esc); };
  }, [picker]);

  const units = useMemo(() => pathFor(course).map((u: Unit) => {
    const w = words[u.word], s = skills[u.sentence], d = topics[u.dialogue];
    const steps: Step[] = [
      { n: 1, mode: "Word Mode", href: `/word/${u.word}`, emoji: w?.emoji ?? "🃏", title: titleize(u.word), done: !!w?.passed },
      { n: 2, mode: "Sentence Mode", href: `/sentence/${u.sentence}`, emoji: s?.emoji ?? "🗣️", title: s?.title ?? titleize(u.sentence), done: !!s?.passed },
      { n: 3, mode: "Dialogue Mode", href: `/dialogue/${u.dialogue}`, emoji: d?.emoji ?? "💭", cover: d?.cover, title: d?.title ?? titleize(u.dialogue), done: !!d?.passed },
    ];
    return { title: u.title, steps };
  }), [course, words, skills, topics]);

  const total = units.length * 3;
  const done = units.reduce((n, u) => n + u.steps.filter((s) => s.done).length, 0);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <h1 className="text-lg font-semibold">Learning path</h1>
      <p className="mt-3 text-[13px] text-white/80">Learning path of currently selected course.</p>
      <hr className="mt-4 border-white/10" />

      <div ref={pickerRef} className="relative mt-4">
        <button onClick={() => setPicker((v) => !v)} aria-haspopup="listbox" aria-expanded={picker} aria-label="Change course"
          className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-[13px] font-semibold hover:bg-white/5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-lg ${tileOf(course)}`}>{course.emoji}</span>
          {course.title}
          <ChevronDown size={14} className={`transition-transform ${picker ? "rotate-180" : ""}`} />
        </button>
        {picker && (
          <div role="listbox" aria-label="Courses" className="absolute left-0 top-full z-20 mt-2 max-h-[60vh] w-[280px] overflow-y-auto rounded-2xl border border-white/10 bg-[#1f1f27] p-2 shadow-2xl">
            {COURSE_GROUPS.map((g) => (
              <div key={g.id} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">{g.title}</p>
                {COURSES.filter((c) => c.group === g.id).map((c) => (
                  <button key={c.id} role="option" aria-selected={c.id === course.id} onClick={() => { setPicker(false); onSelectCourse(c); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold hover:bg-white/5 ${c.id === course.id ? "bg-white/10" : ""}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-sm ${tileOf(c)}`}>{c.emoji}</span>
                    <span className="flex-1">{c.title}</span>
                    {c.badge && <span className="text-[10px] text-white/50">{c.badge}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <hr className="mt-4 border-white/10" />

      <div className="mt-5 flex items-center gap-2" aria-label={`Course progress ${percent}%`}>
        <span className="z-[1] rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">{percent}%</span>
        <div className="-ml-4 h-1 flex-1 overflow-hidden rounded-full bg-indigo-300/60">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {units.map((u, ui) => (
        <section key={ui} className="mt-8" aria-label={`Unit ${ui + 1}: ${u.title}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-300">Unit {ui + 1}</p>
              <h2 className="mt-1 text-base font-semibold">{u.title}</h2>
            </div>
            <button onClick={() => setGuide(ui)} aria-label={`About unit ${ui + 1}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"><BookOpen size={14} /></button>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {u.steps.map((s, i) => {
              const row = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800 text-xl">
                    {s.cover
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : s.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-semibold">Exercise {s.n}</span>
                    <span className="block text-[11px] text-white/60">{s.mode}</span>
                  </span>
                  {s.done && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-indigo-600"><Check size={14} strokeWidth={3} /></span>}
                </>
              );
              const cls = "flex w-full items-center gap-4 rounded-xl border border-white/5 bg-[#1f1f27] px-3 py-3 text-left transition-colors hover:border-white/20";
              return (
                <li key={s.n} className="relative">
                  {i < 2 && <span aria-hidden="true" className="absolute left-[29px] top-full h-3 w-px bg-white/10" />}
                  {premium
                    ? <Link href={s.href} aria-label={`Unit ${ui + 1}, exercise ${s.n}, ${s.mode}${s.done ? ", completed" : ""}`} className={cls}>{row}</Link>
                    : <button onClick={() => onLocked(s.mode)} className={cls}>{row}</button>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {guide !== null && (
        <Modal onClose={() => setGuide(null)} label={`Unit ${guide + 1}`}>
          <p className="text-xs font-semibold text-indigo-300">Unit {guide + 1}</p>
          <h2 className="mt-1 text-xl font-semibold">{units[guide].title}</h2>
          <ul className="mt-5 flex flex-col gap-2">
            {units[guide].steps.map((s) => (
              <li key={s.n} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-[13px]">
                <span className="text-xl">{s.emoji}</span>
                <span className="flex-1"><span className="block font-semibold">{s.title}</span><span className="block text-[11px] text-white/60">Exercise {s.n} · {s.mode}</span></span>
                {s.done && <Check size={16} className="text-emerald-300" />}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
