"use client";

// flag-icons draws each flag as a CSS background picture (real flags, so they also show on Windows, where flag emoji do not)
import "flag-icons/css/flag-icons.min.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { countries, countryByCode, searchCountries } from "@/lib/countries";

const PAGE = 40; // rows drawn at first and per scroll step: each flag is a picture, so the whole list is not loaded at once
const LIST_MAX = 340;
const GAP = 6;

export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return <span aria-hidden="true" className={`fi fi-${code.toLowerCase()} shrink-0 rounded-[3px] ${className}`} />;
}

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/**
 * A searchable country list with real flags. `variant="country"` is a full-width form field that shows the flag and the
 * country name; `variant="dial"` is the small button in front of a phone number that shows the flag and "+880", and its
 * list also shows each calling code. The list is `position: fixed` (never clipped by the form) and opens upward when
 * there is more room above. Keyboard: type to search, Arrow keys, Home/End, Enter, Escape.
 */
export function CountryPicker({ value, onChange, variant, ariaLabel, placeholder = "Select country", invalid = false, returnFocus = true, compact = false, className = "" }: {
  value: CountryCode | null;
  onChange: (code: CountryCode) => void;
  variant: "country" | "dial";
  ariaLabel: string;
  placeholder?: string;
  invalid?: boolean;
  /** Put the focus back on the button after a pick. Turn off when the parent moves the focus on (e.g. to the phone input). */
  returnFocus?: boolean;
  /** Tighter paddings, for forms that have to fit on one screen. */
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [pos, setPos] = useState<Pos | null>(null);

  const all = useMemo(() => (open ? countries() : []), [open]);
  const results = useMemo(() => searchCountries(all, q), [all, q]);
  const current = countryByCode(value);
  const dial = variant === "dial";

  const measure = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    const up = below < 240 && above > below;
    const width = Math.min(Math.max(r.width, dial ? 320 : 0), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setPos(up
      ? { left, width, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(LIST_MAX, above) }
      : { left, width, top: r.bottom + GAP, maxHeight: Math.min(LIST_MAX, below) });
  }, [dial]);

  const close = useCallback(() => { setOpen(false); setPos(null); setQ(""); }, []);

  function openList() {
    measure();
    const at = current ? countries().findIndex((c) => c.code === current.code) : 0;
    setQ(""); setActive(Math.max(0, at)); setShown(Math.max(PAGE, at + 12)); setOpen(true);
  }

  function choose(i: number) {
    const c = results[i];
    if (!c) return;
    close();
    onChange(c.code);
    if (returnFocus) btn.current?.focus();
  }

  // outside click, Escape (captured, so nothing else reacts to it), and keeping the list under the button while the page scrolls or resizes.
  // It does not close on resize: a phone's on-screen keyboard resizes the window as soon as the search box gets the focus.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const move = (e: Event) => { if (!list.current?.contains(e.target as Node)) measure(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    window.addEventListener("scroll", move, true);
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", key, true);
    };
  }, [open, close, measure]);

  useEffect(() => { if (open && pos) search.current?.focus({ preventScroll: true }); }, [open, !!pos]); // eslint-disable-line react-hooks/exhaustive-deps

  // a new search starts at the top
  useEffect(() => { setActive(0); setShown(PAGE); list.current?.scrollTo({ top: 0 }); }, [q]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, pos, shown]);

  function onKeyDown(e: React.KeyboardEvent) {
    const last = results.length - 1;
    const go = (i: number) => { const n = Math.max(0, Math.min(last, i)); setActive(n); setShown((s) => Math.max(s, n + 12)); };
    if (e.key === "ArrowDown") { e.preventDefault(); go(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); go(active - 1); }
    else if (e.key === "PageDown") { e.preventDefault(); go(active + 8); }
    else if (e.key === "PageUp") { e.preventDefault(); go(active - 8); }
    else if (e.key === "Home" && !q) { e.preventDefault(); go(0); }
    else if (e.key === "End" && !q) { e.preventDefault(); go(last); }
    else if (e.key === "Enter") { e.preventDefault(); choose(active); } // never submits the sign-up form
    else if (e.key === "Tab") close();
  }

  function onListScroll(e: React.UIEvent<HTMLUListElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) setShown((s) => (s < results.length ? s + PAGE : s));
  }

  const trigger = dial
    ? `flex items-center ${compact ? "gap-1.5 pl-3 pr-2" : "gap-2 pl-3.5 pr-2.5"} rounded-l-2xl text-sm outline-none hover:bg-white/5 focus-visible:bg-white/10`
    : `flex w-full items-center gap-3 rounded-2xl border bg-white/5 ${compact ? "py-2.5" : "py-3.5"} pl-3.5 pr-3 text-left text-sm outline-none transition-colors ${open ? "border-violet-400 ring-2 ring-violet-500/30" : invalid ? "border-red-400/60" : "border-white/15 hover:border-white/30"} focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-500/30`;

  return (
    <div ref={root} className={`relative ${className}`}>
      <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={`${ariaLabel}${current ? `: ${current.name}${dial ? ` +${current.dial}` : ""}` : ""}`}
        onClick={() => (open ? close() : openList())} className={trigger}>
        <span className="grid w-5 shrink-0 place-items-center">
          {current ? <Flag code={current.code} className="text-[15px]" /> : <Globe size={dial ? 18 : 20} className="text-white/50" />}
        </span>
        {dial ? (
          <span className={`tabular-nums ${current ? "text-white" : "text-white/50"}`}>{current ? `+${current.dial}` : "Code"}</span>
        ) : (
          <span className={`min-w-0 flex-1 truncate ${current ? "text-white" : "text-white/45"}`}>{current ? current.name : placeholder}</span>
        )}
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-white/50 transition-transform duration-150 ${open ? "rotate-180 text-violet-300" : ""}`} />
      </button>

      {open && pos && (
        <div style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          className="z-[70] flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#1d1640] shadow-2xl shadow-black/60">
          <div className="relative border-b border-white/10 p-2">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
            <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder={dial ? "Search country or code" : "Search country"}
              role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={results[active] ? `${id}-${results[active].code}` : undefined}
              aria-label={dial ? "Search country or code" : "Search country"} autoComplete="off" autoCorrect="off" spellCheck={false}
              className="w-full rounded-xl bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-violet-500/40" />
          </div>
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label={ariaLabel} onScroll={onListScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            {results.slice(0, shown).map((c, i) => {
              const picked = c.code === value;
              return (
                <li key={c.code} id={`${id}-${c.code}`} role="option" aria-selected={picked} data-i={i}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm ${i === active ? "bg-white/10" : ""} ${picked ? "font-medium text-violet-200" : "text-white/85"}`}>
                  <Flag code={c.code} className="text-lg" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {dial && <span className="shrink-0 tabular-nums text-white/50">+{c.dial}</span>}
                  {picked && <Check size={15} aria-hidden="true" className="shrink-0 text-violet-300" />}
                </li>
              );
            })}
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-white/50">No country found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
