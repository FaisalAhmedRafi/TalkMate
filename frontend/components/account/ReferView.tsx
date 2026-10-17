"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Crown, Gift, Link2, Star } from "lucide-react";
import { ErrorText } from "@/components/Modal";
import { api, type Referral } from "@/lib/api";
import { SubPage } from "./SubPage";

const STEPS = [
  { icon: Link2, title: "Invite your friends", sub: "Share the invite link with your friends." },
  { icon: Crown, title: "Friend joins TalkMate", sub: "They sign up with your link and start a subscription." },
  { icon: Gift, title: "You both get 1 month free Premium", sub: "Your subscription will be extended." },
];

export function ReferView({ onBack, onToast }: { onBack: () => void; onToast: (message: string) => void }) {
  const [info, setInfo] = useState<Referral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.account.referral().then(setInfo).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your invite link"));
  }, []);

  const link = info ? `${window.location.origin}/login?ref=${info.code}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  return (
    <SubPage title="Refer a friend" subtitle="Get 1 month Premium for free." onBack={onBack}>
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl text-center"
        style={{ background: "repeating-conic-gradient(from 0deg at 50% 36%, rgba(255,255,255,0.07) 0deg 12deg, transparent 12deg 24deg), #2b3ad0" }}>
        <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-pink-500 ring-4 ring-pink-300/40">
          <Star size={46} fill="white" className="text-white" />
        </span>
        <p className="mt-4 text-2xl font-semibold">Give 1 month. Get 1 month.</p>
        <p className="mt-1 text-xs font-semibold">Invite friends. Extend your Premium.</p>
      </div>

      <section className="mt-6 rounded-3xl bg-[#1f1f27] p-6">
        <h2 className="font-semibold">Share your link</h2>
        <div className="mt-4 flex items-center gap-3 rounded-full border border-white/10 px-5 py-3">
          <input readOnly value={link || "Loading…"} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 truncate bg-transparent text-sm font-semibold outline-none" />
          <button onClick={copy} disabled={!info} aria-label="Copy invite link" className="shrink-0 text-white/90 hover:text-white disabled:opacity-40">
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>
        <ErrorText text={error} />
        {info && <p className="mt-3 text-xs text-white/60">{info.invited} {info.invited === 1 ? "friend has" : "friends have"} joined with your link · {info.rewarded} rewarded</p>}
      </section>

      <section className="mt-6 rounded-[28px] bg-[#a9acf0] p-4">
        <ul className="rounded-2xl bg-[#16161c] p-6">
          {STEPS.map(({ icon: Icon, title, sub }, i) => (
            <li key={title} className="relative flex items-center gap-4 pb-6 last:pb-0">
              {i < STEPS.length - 1 && <span aria-hidden className="absolute left-6 top-12 h-6 border-l border-dashed border-white/20" />}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/40"><Icon size={20} /></span>
              <span><span className="block font-semibold">{title}</span><span className="text-xs text-white/70">{sub}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-center text-xs font-semibold leading-5">
        Premium extension is added once your invited friend starts a subscription as a new TalkMate user. The offer doesn't apply to existing accounts.
      </p>
    </SubPage>
  );
}
