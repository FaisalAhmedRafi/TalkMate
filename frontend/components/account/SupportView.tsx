"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Mail } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { api } from "@/lib/api";
import { SubPage } from "./SubPage";

export const SUPPORT_EMAIL = "support@talkmate.ai";
// keep in step with SUPPORT_TYPES in backend/src/account/account.options.ts
const ISSUE_TYPES = ["Account or login", "Subscription or billing", "Bug or technical problem", "Feedback or suggestion", "Other"];

const field = "w-full rounded-3xl border border-white/10 bg-[#1f1f27] px-5 text-sm font-semibold outline-none transition-colors placeholder:text-white/60 focus:border-white/30";

export function SupportView({ onBack, onToast }: { onBack: () => void; onToast: (message: string) => void }) {
  const [form, setForm] = useState(false);

  if (form) return <ContactForm onBack={() => setForm(false)} onSent={() => { setForm(false); onToast("Message sent. We'll get back to you within 2 working days."); }} />;

  return (
    <SubPage title="Support" subtitle="Find all the necessary information below." onBack={onBack}>
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1f1f27]">
        <button onClick={() => setForm(true)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5">
          <Mail size={22} />
          <span>
            <span className="block font-semibold">Contact us</span>
            <span className="text-xs text-white/60">Contact our support team.</span>
          </span>
        </button>
      </div>
      <p className="mt-8 text-center text-xs font-semibold text-white/80">
        Customer support:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-white">{SUPPORT_EMAIL}</a>
      </p>
    </SubPage>
  );
}

function ContactForm({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const [type, setType] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!type && !!message.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try { await api.account.sendSupport({ type, message: message.trim() }); onSent(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't send your message"); setBusy(false); }
  };

  return (
    <SubPage title="Send us an email" subtitle="Describe your issue or a feedback and we will get back to you via email within 2 working days." onBack={onBack}>
      <form onSubmit={submit} className="space-y-6">
        <IssueSelect value={type} onChange={setType} />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} placeholder="Type here..." aria-label="Your message"
          className={`${field} h-80 resize-none py-5`} />
        <ErrorText text={error} />
        <button type="submit" disabled={!ready || busy}
          className={`w-full rounded-2xl py-4 text-sm font-semibold transition-colors ${ready && !busy ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/40"}`}>
          {busy ? "Sending…" : "Submit"}
        </button>
      </form>
    </SubPage>
  );
}

/** Custom dropdown (a native <select> can't be styled to match the app): click, arrow keys + Enter, Escape or a click outside closes it. */
function IssueSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const n = ISSUE_TYPES.length;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const show = () => { setActive(Math.max(0, ISSUE_TYPES.indexOf(value))); setOpen(true); };
  const pick = (t: string) => { onChange(t); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) show(); else setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); pick(ISSUE_TYPES[active]); }
  };

  return (
    <div ref={box} className="relative" onKeyDown={onKey}>
      <button type="button" onClick={() => (open ? setOpen(false) : show())} aria-haspopup="listbox" aria-expanded={open} aria-label="Type of issue"
        className={`${field} flex items-center justify-between py-5 text-left ${open ? "border-white/30" : ""} ${value ? "text-white" : "text-white/70"}`}>
        {value || "Type of issue"}
        <ChevronDown size={18} className={`shrink-0 text-white transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label="Type of issue"
          className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#25252f] py-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          {ISSUE_TYPES.map((t, i) => (
            <li key={t} role="option" aria-selected={t === value} onClick={() => pick(t)} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-semibold transition-colors ${i === active ? "bg-white/[0.07]" : ""} ${t === value ? "text-white" : "text-white/80"}`}>
              {t}
              {t === value && <Check size={16} className="text-indigo-400" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
