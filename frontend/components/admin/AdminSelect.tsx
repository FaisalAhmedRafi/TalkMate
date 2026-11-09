"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const LIST_MAX = 288; // px, the tallest the pop-up list gets before it scrolls
const GAP = 6;

/**
 * The admin panel's select box: a button that opens a rounded, dark pop-up list (the browser's own list cannot be styled).
 * Keyboard: Arrow keys, Home/End, Enter or Space to pick, Escape or Tab to close. The list is `position: fixed`, so a
 * scrolling modal never clips it, and it opens upward when there is more room above the button.
 */
export function AdminSelect({ value, onChange, options, ariaLabel, placeholder = "Choose…", variant = "field", className = "" }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  /** Shown when `value` matches no option. */
  placeholder?: string;
  /** "field": a full-width form field (modal). "compact": a toolbar filter. */
  variant?: "field" | "compact";
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<Pos | null>(null);

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  const close = useCallback(() => { setOpen(false); setPos(null); }, []);

  const measure = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    const up = below < 200 && above > below;
    const width = Math.max(r.width, variant === "compact" ? 200 : 0);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setPos(up
      ? { left, width, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(LIST_MAX, above) }
      : { left, width, top: r.bottom + GAP, maxHeight: Math.min(LIST_MAX, below) });
  }, [variant]);

  function openList() {
    if (!options.length) return;
    measure();
    setActive(selectedIdx >= 0 && !options[selectedIdx].disabled ? selectedIdx : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }

  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
    btn.current?.focus();
  }

  function move(from: number, dir: 1 | -1) {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return from;
  }

  // outside click, resize, scrolling anywhere but the list, and Escape (captured so a modal does not close with it)
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const scroll = (e: Event) => { if (!list.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", key, true);
    };
  }, [open, close]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open && active >= 0) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, pos]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => move(a, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => move(a, -1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(move(-1, 1)); }
    else if (e.key === "End") { e.preventDefault(); setActive(move(options.length, -1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Tab") close();
  }

  const surface = variant === "compact" ? "bg-[#171827]" : "bg-[#16161c]";

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={btn} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 ${surface} ${open ? "border-violet-400/50 ring-2 ring-violet-500/30" : "border-white/10 hover:border-white/25"}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-white" : "text-white/40"}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 text-white/50 transition-transform duration-150 ${open ? "rotate-180 text-violet-300" : ""}`} />
      </button>

      {open && pos && (
        <ul
          ref={list} id={`${id}-list`} role="listbox" aria-label={ariaLabel}
          onClick={(e) => e.preventDefault()} // a click inside the list must not reach a surrounding <label> and re-open it
          style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          className="z-[60] overflow-y-auto rounded-xl border border-white/10 bg-[#1d1e2e] p-1 shadow-2xl shadow-black/60 ring-1 ring-black/30"
        >
          {options.map((o, i) => {
            const isSel = i === selectedIdx;
            return (
              <li
                key={`${o.value}-${i}`} role="option" aria-selected={isSel} aria-disabled={o.disabled} data-i={i}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={(e) => { e.preventDefault(); choose(i); }}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${o.disabled ? "cursor-not-allowed text-white/25" : "cursor-pointer"} ${!o.disabled && i === active ? "bg-white/[0.08]" : ""} ${isSel ? "font-medium text-violet-200" : o.disabled ? "" : "text-white/80"}`}
              >
                <span className="min-w-0 flex-1 truncate" title={o.label}>{o.label}</span>
                {isSel && <Check size={15} aria-hidden className="shrink-0 text-violet-300" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
