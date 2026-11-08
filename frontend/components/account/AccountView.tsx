"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Gift, LayoutList, LifeBuoy, LogOut, Settings, SlidersHorizontal, User, type LucideIcon } from "lucide-react";
import type { Progress } from "@/lib/api";
import { admin } from "@/lib/admin";
import { PersonalizationView } from "./PersonalizationView";
import { ProfileView } from "./ProfileView";
import { ReferView } from "./ReferView";
import { SettingsView } from "./SettingsView";
import { SupportView } from "./SupportView";
import { SubscriptionView } from "./SubscriptionView";

type View = "menu" | "personalization" | "subscriptions" | "refer" | "profile" | "settings" | "support";

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

export function AccountView({ s, onSettings, onLogout, onToast, onSnapshot }: {
  s: Progress; onSettings: (patch: { language?: string; nativeLanguage?: string; level?: string }) => void; onLogout: () => void;
  onToast: (message: string) => void; onSnapshot: (p: Progress) => void;
}) {
  const [view, setView] = useState<View>("menu");
  const router = useRouter();
  // only admins (ADMIN_EMAILS on the backend) see the Admin panel row
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { admin.me().then((r) => setIsAdmin(r.admin)).catch(() => {}); }, []);
  const back = () => setView("menu");

  if (view === "personalization") return <PersonalizationView onBack={back} onToast={onToast} />;
  if (view === "settings") return <SettingsView s={s} onBack={back} onSettings={onSettings} onToast={onToast} />;
  if (view === "profile") return <ProfileView onBack={back} onToast={onToast} onSnapshot={onSnapshot} onLogout={onLogout} />;
  if (view === "support") return <SupportView onBack={back} onToast={onToast} />;
  if (view === "refer") return <ReferView onBack={back} onToast={onToast} />;
  if (view === "subscriptions") return <SubscriptionView onBack={back} onToast={onToast} onSnapshot={onSnapshot} />;

  return (
    <div className="mx-auto max-w-[656px] pt-1">
      <h1 className="border-b border-white/5 pb-6 text-lg font-semibold">Account</h1>

      <h2 className="mt-8 text-xl font-semibold">Account settings</h2>
      <div className="mt-5 flex flex-col gap-4">
        <div className={card}><Row icon={User} title="Profile" sub="Manage your profile details." onClick={() => setView("profile")} /></div>
        <div className={card}><Row icon={SlidersHorizontal} title="Personalization" sub="Adapt the app for your needs." onClick={() => setView("personalization")} /></div>
        <div className={`${card} divide-y divide-white/5`}>
          <Row icon={Settings} title="Settings" sub="Manage your account settings." onClick={() => setView("settings")} />
          <Row icon={CalendarCheck} title="Subscriptions" sub="Manage your subscriptions." onClick={() => setView("subscriptions")} />
          <Row icon={Gift} title="Refer a friend" sub="Get 1 month Premium for free." onClick={() => setView("refer")} />
          {isAdmin && <Row icon={LayoutList} title="Admin panel" sub="View and add learning content." onClick={() => router.push("/admin")} />}
          <Row icon={LifeBuoy} title="Support" sub="Contact our support team." onClick={() => setView("support")} />
          <Row icon={LogOut} title="Log out" sub="Log out from this profile." onClick={onLogout} danger />
        </div>
      </div>

      <div className="mt-10 pb-6 text-center text-[11px] leading-5 text-white/70">
        {FOOTER.map((t) => <p key={t}>{t}</p>)}
      </div>
    </div>
  );
}