"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { COURSES, COURSE_GROUPS, COURSE_PHOTO, type Course } from "@/lib/courses";

// Static class names so Tailwind can see them; each course gets one by its position.
const TILES = [
  "from-indigo-500 to-violet-600", "from-pink-500 to-rose-600", "from-amber-400 to-orange-600", "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-700", "from-fuchsia-500 to-purple-700",
];
export const tileOf = (c: Course) => TILES[COURSES.indexOf(c) % TILES.length];

// One photo per course, searched by its phrase in COURSE_PHOTO (12 searches max per call). The result is cached for the page's lifetime,
// so Courses, the Learn tab and the course picker share one request. Without photos the gradient + emoji stay.
let coversCache: Promise<Record<string, string | null>> | null = null;
function loadCourseCovers() {
  if (!coversCache) {
    const phrases = [...new Set(Object.values(COURSE_PHOTO))];
    const chunks: string[][] = [];
    for (let i = 0; i < phrases.length; i += 12) chunks.push(phrases.slice(i, i + 12));
    coversCache = Promise.allSettled(chunks.map((c) => api.word.unitCovers(c))).then((rs) => {
      const merged: Record<string, string | null> = {};
      for (const r of rs) if (r.status === "fulfilled") Object.assign(merged, r.value.covers);
      if (!Object.keys(merged).length) coversCache = null; // everything failed: allow a retry next time
      return merged;
    });
  }
  return coversCache;
}

/** Course photos keyed by the COURSE_PHOTO phrase. Empty until they arrive (or when they can't be loaded). */
export function useCourseCovers() {
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let live = true;
    loadCourseCovers().then((c) => { if (live) setCovers(c); });
    return () => { live = false; };
  }, []);
  return covers;
}

/** A course's picture on its gradient tile, with the emoji underneath as the fallback. `className` sets the size and shape. */
export function CourseThumb({ course, covers, className = "" }: { course: Course; covers: Record<string, string | null>; className?: string }) {
  const src = covers[COURSE_PHOTO[course.id]];
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ${tileOf(course)} ${className}`}>
      {course.emoji}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" draggable={false}
          onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}

/** Courses: every course as a card. Picking one makes it the selected course and opens its learning path. */
export function CoursesView({ selected, onSelect }: { selected: string; onSelect: (c: Course) => void }) {
  const covers = useCourseCovers();

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <h1 className="text-lg font-semibold">Courses</h1>
      <p className="mt-3 text-[13px] text-white/80">Advance your language skills with a guided curriculum tailored to your knowledge level.</p>
      <hr className="mt-4 border-white/10" />

      {COURSE_GROUPS.map((g) => (
        <section key={g.id} className="mt-8" aria-label={g.title}>
          <h2 className="text-sm font-semibold">{g.title}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {COURSES.filter((c) => c.group === g.id).map((c) => (
              <li key={c.id}>
                <button onClick={() => onSelect(c)} aria-label={`Open the ${c.title} course`} aria-current={c.id === selected ? "true" : undefined}
                  className={`flex h-[116px] w-full gap-4 rounded-2xl border bg-[#1f1f27] p-3.5 text-left transition-colors hover:border-white/25 border-white/5 focus:outline-none focus-visible:border-white/25`}>
                  <CourseThumb course={c} covers={covers} className="w-[70px] rounded-xl text-3xl" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold">{c.title}</span>
                    <span className="mt-1 text-[11px] leading-snug text-white/70">{c.desc}</span>
                    {c.badge && <span className="mt-auto w-fit rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold">{c.badge}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
