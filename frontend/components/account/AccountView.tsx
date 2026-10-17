"use client";

import { useState } from "react";
import { Building2, CalendarCheck, Check, ChevronRight, Gift, LifeBuoy, LogOut, Settings, SlidersHorizontal, User, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { Progress } from "@/lib/api";
import { LANGUAGES } from "@/lib/modes";
import { PersonalizationView } from "./PersonalizationView";
import { ReferView } from "./ReferView";
import { SubPage } from "./SubPage";
import { SubscriptionView } from "./SubscriptionView";

type View = "menu" | "personalization" | "subscriptions" | "refer" | "profile" | "settings" | "organizations" | "support";

// Two-letter badges instead of flag emoji: Windows does not draw flag emoji.
const LANG_CODE: Record<string, string> = {
  Spanish: "ES", French: "FR", German: "DE", Italian: "IT", Chinese: "ZH", Japanese: "JA",
  Korean: "KO", Hindi: "HI", Bengali: "BN", English: "EN", Russian: "RU", Arabic: "AR",
};
const Badge = ({ lang }: { lang: string }) => (
  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold">{LANG_CODE[lang] ?? "??"}</span>
);

// Sections that are not built yet
const EMPTY_PAGES: Partial<Record<View, { title: string; subtitle: string }>> = {
  profile: { title: "Profile", subtitle: "Manage your profile details." },
  settings: { title: "Settings", subtitle: "Manage your account settings." },
  organizations: { title: "For organizations", subtitle: "Partnerships with TalkMate." },
  support: { title: "Support", subtitle: "Help center and contact." },
};

const FOOTER = [
  "Privacy Policy", "Terms and Conditions", "End User License Agreement",
  "Safety and Crisis Resources", "Cookie Preferences", "Do not sell/share my personal information",
];

function Row({ icon: Icon, title, sub, onClick, danger }: {
  icon: LucideIcon; title: string; sub: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5">
      <Icon size={22} className={danger ? "text-pink-500" : ""} />
      <span>
        <span className={`block font-semibold ${danger ? "text-pink-500" : ""}`}>{title}</span>
        <span className="text-xs text-white/60">{sub}</span>
      </span>
    </button>
  );
}
const card = "overflow-hidden rounded-2xl border border-white/5 bg-[#1f1f27]";

export function AccountView({ s, onLanguage, onLogout, onToast, onSnapshot }: {
  s: Progress; onLanguage: (language: string) => void; onLogout: () => void;
  onToast: (message: string) => void; onSnapshot: (p: Progress) => void;
}) {
  const [view, setView] = useState<View>("menu");
  const [langOpen, setLangOpen] = useState(false);
  const back = () => setView("menu");

  if (view === "personalization") return <PersonalizationView onBack={back} onToast={onToast} />;
  if (view === "refer") return <ReferView onBack={back} onToast={onToast} />;
  if (view === "subscriptions") return <SubscriptionView onBack={back} onToast={onToast} onSnapshot={onSnapshot} />;
  const empty = EMPTY_PAGES[view];
  if (empty) return <SubPage title={empty.title} subtitle={empty.subtitle} onBack={back}><p className="text-white/60">This section isn't built yet.</p></SubPage>;

  return (
    <div className="mx-auto max-w-[656px] pt-1">
      <h1 className="border-b border-white/5 pb-6 text-lg font-semibold">Account</h1>

      <h2 className="mt-8 text-xl font-semibold">Target language</h2>
      <button onClick={() => setLangOpen(true)} className={`${card} mt-5 flex w-full items-center gap-3 px-5 py-4 text-left hover:border-white/20`}>
        <Badge lang={s.language} />
        <span className="flex-1 font-semibold">{s.language}</span>
        <ChevronRight size={18} />
      </button>

      <h2 className="mt-8 text-xl font-semibold">Account settings</h2>
      <div className="mt-5 flex flex-col gap-4">
        <div className={card}><Row icon={User} title="Profile" sub="Manage your profile details." onClick={() => setView("profile")} /></div>
        <div className={card}><Row icon={SlidersHorizontal} title="Personalization" sub="Adapt the app for your needs." onClick={() => setView("personalization")} /></div>
        <div className={`${card} divide-y divide-white/5`}>
          <Row icon={Settings} title="Settings" sub="Manage your account settings." onClick={() => setView("settings")} />
          <Row icon={CalendarCheck} title="Subscriptions" sub="Manage your subscriptions." onClick={() => setView("subscriptions")} />
          <Row icon={Gift} title="Refer a friend" sub="Get 1 month Premium for free." onClick={() => setView("refer")} />
          <Row icon={Building2} title="For organizations" sub="Partnerships with TalkMate." onClick={() => setView("organizations")} />
          <Row icon={LifeBuoy} title="Support" sub="Help center and contact." onClick={() => setView("support")} />
          <Row icon={LogOut} title="Log out" sub="Log out from this profile." onClick={onLogout} danger />
        </div>
      </div>

      <div className="mt-10 pb-6 text-center text-[11px] leading-5 text-white/70">
        {FOOTER.map((t) => <p key={t}>{t}</p>)}
      </div>

      {langOpen && (
        <Modal onClose={() => setLangOpen(false)} label="Target language">
          <h2 className="text-xl font-semibold">Target language</h2>
          <ul className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
            {LANGUAGES.map((l) => (
              <li key={l}>
                <button onClick={() => { if (l !== s.language) onLanguage(l); setLangOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5">
                  <Badge lang={l} />
                  <span className="flex-1 font-semibold">{l}</span>
                  {l === s.language && <Check size={18} className="text-indigo-400" />}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
