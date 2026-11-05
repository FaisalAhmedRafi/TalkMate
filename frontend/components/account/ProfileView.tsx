"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Eye, EyeOff, Lock, Mail, Plus, Shield, Trash2, User, type LucideIcon } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { api, type NotificationPrefs, type PrivacyPrefs, type ProfileData, type Progress } from "@/lib/api";
import { SubPage } from "./SubPage";

type Page = "menu" | "details" | "password" | "email" | "app" | "privacy";

const card = "overflow-hidden rounded-2xl border border-white/5 bg-[#1f1f27]";
const input = "w-full rounded-2xl border border-white/10 bg-[#1f1f27] px-5 py-4 text-sm font-semibold outline-none transition-colors placeholder:text-white/50 focus:border-white/30";
const label = "mb-3 block text-sm font-semibold";

// "UTC-12:00" ... "UTC+14:00", including the half and quarter hour zones
const OFFSET_MINUTES = [
  ...Array.from({ length: 27 }, (_, i) => (i - 12) * 60),
  -570, -210, 210, 270, 330, 345, 390, 525, 570, 630, 765,
].sort((a, b) => a - b);
const pad = (n: number) => String(n).padStart(2, "0");
const TIME_ZONES = OFFSET_MINUTES.map((m) => `UTC${m < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`);

const AVATAR_SIZE = 256; // px, the picture is cropped to a square and shrunk to this before upload

/** Reads a picture file, crops it to the centre square and returns a small JPEG data URL. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("Couldn't read that picture.")); }
      ctx.fillStyle = "#fff"; // transparent PNGs get a white background in the JPEG
      ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that picture.")); };
    img.src = url;
  });
}

export function ProfileView({ onBack, onToast, onSnapshot, onLogout }: {
  onBack: () => void; onToast: (message: string) => void; onSnapshot: (p: Progress) => void; onLogout: () => void;
}) {
  const [page, setPage] = useState<Page>("menu");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const back = () => setPage("menu");

  useEffect(() => {
    api.account.profile().then(setProfile).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your profile"));
  }, []);

  const deleteAccount = async () => {
    setDeleting(true);
    try { await api.account.deleteAccount(); onLogout(); }
    catch (e) { onToast(e instanceof Error ? e.message : "Couldn't delete your account"); setDeleting(false); setConfirmDelete(false); }
  };

  if (!profile) {
    return (
      <SubPage title="Profile" subtitle="Manage your profile information below." onBack={onBack}>
        {error ? <ErrorText text={error} /> : <p className="text-sm text-white/60">Loading…</p>}
      </SubPage>
    );
  }

  if (page === "details") return <DetailsPage profile={profile} onBack={back} onSaved={setProfile} onToast={onToast} onSnapshot={onSnapshot} />;
  if (page === "password") return <PasswordPage onBack={back} onToast={onToast} />;
  if (page === "email" || page === "app") return <NotificationsPage kind={page} profile={profile} onBack={back} onChange={setProfile} onToast={onToast} />;
  if (page === "privacy") return <PrivacyPage profile={profile} onBack={back} onChange={setProfile} onToast={onToast} />;

  const rows: { icon: LucideIcon; title: string; sub: string; page: Page }[] = [
    { icon: User, title: "Personal details", sub: "Manage your personal details below.", page: "details" },
    { icon: Lock, title: "Change password", sub: "Change your current password.", page: "password" },
    { icon: Mail, title: "Email notifications", sub: "Manage your email notifications.", page: "email" },
    { icon: Bell, title: "App notifications", sub: "Manage your app notifications.", page: "app" },
    { icon: Shield, title: "Privacy preferences", sub: "Manage your privacy preferences.", page: "privacy" },
  ];

  return (
    <SubPage title="Profile" subtitle="Manage your profile information below." onBack={onBack}>
      <div className={`${card} divide-y divide-white/5`}>
        {rows.map(({ icon: Icon, title, sub, page: target }) => (
          <button key={target} onClick={() => setPage(target)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5">
            <Icon size={22} />
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="text-xs text-white/60">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={`${card} mt-8`}>
        <button onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5">
          <Trash2 size={22} className="text-pink-500" />
          <span>
            <span className="block font-semibold text-pink-500">Delete account</span>
            <span className="text-xs text-white/60">This action can not be undone.</span>
          </span>
        </button>
      </div>

      {confirmDelete && (
        <Modal onClose={() => !deleting && setConfirmDelete(false)} label="Delete account">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-200 text-pink-600"><Trash2 size={22} /></span>
          <h2 className="mt-6 text-2xl font-bold">Delete account?</h2>
          <p className="mt-3 text-[15px] font-semibold leading-relaxed text-white/80">Are you sure you want to delete your account? This action can not be undone.</p>
          <button onClick={deleteAccount} disabled={deleting}
            className="mt-8 w-full rounded-2xl border border-white/15 py-4 text-sm font-semibold text-pink-500 transition-colors hover:bg-white/5 disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} disabled={deleting}
            className="mt-3 w-full rounded-2xl bg-indigo-600 py-4 text-sm font-semibold transition-colors hover:bg-indigo-500 disabled:opacity-50">
            Cancel
          </button>
        </Modal>
      )}
    </SubPage>
  );
}

const saveBtn = (enabled: boolean) =>
  `mt-2 w-full rounded-2xl py-4 text-sm font-semibold transition-colors ${enabled ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/40"}`;

function DetailsPage({ profile, onBack, onSaved, onToast, onSnapshot }: {
  profile: ProfileData; onBack: () => void; onSaved: (p: ProfileData) => void; onToast: (m: string) => void; onSnapshot: (p: Progress) => void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // the picture saves on its own, it does not wait for the Save button
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return onToast("Choose a JPG, PNG or WebP picture.");
    if (file.size > 10 * 1024 * 1024) return onToast("That picture is too big. Choose one under 10 MB.");
    setPhotoBusy(true);
    try { onSaved(await api.account.saveAvatar(await resizeImage(file))); onToast("Photo saved"); }
    catch (err) { onToast(err instanceof Error ? err.message : "Couldn't save the picture"); }
    finally { setPhotoBusy(false); }
  };
  const removePhoto = async () => {
    setPhotoBusy(true);
    try { onSaved(await api.account.removeAvatar()); onToast("Photo removed"); }
    catch (err) { onToast(err instanceof Error ? err.message : "Couldn't remove the picture"); }
    finally { setPhotoBusy(false); }
  };
  const dirty = firstName.trim() !== profile.firstName || lastName.trim() !== profile.lastName || timeZone !== profile.timeZone;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true); setError(null);
    try {
      const saved = await api.account.saveProfile({ firstName: firstName.trim(), lastName: lastName.trim(), timeZone });
      onSaved(saved);
      setFirstName(saved.firstName); setLastName(saved.lastName);
      api.progress.get().then(onSnapshot).catch(() => {}); // the name in the top-right corner
      onToast("Saved");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save"); }
    finally { setBusy(false); }
  };

  return (
    <SubPage title="Personal details" subtitle="Manage your personal details below." onBack={onBack}>
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#1f1f27]">
          {profile.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.avatar} alt="Your profile picture" className="h-full w-full object-cover" />
            : <User size={64} className="text-white/70" />}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="hidden" aria-label="Upload a profile picture" />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50">
            {!profile.avatar && <Plus size={16} />}{photoBusy ? "Saving…" : profile.avatar ? "Change photo" : "Add photo"}
          </button>
          {profile.avatar && (
            <button type="button" onClick={removePhoto} disabled={photoBusy}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-pink-500 transition-colors hover:bg-white/5 disabled:opacity-50">
              Remove
            </button>
          )}
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div>
          <label htmlFor="email" className={label}>Your email address</label>
          <input id="email" value={profile.email} readOnly aria-readonly className={`${input} cursor-default text-white/70`} />
        </div>
        <div>
          <label htmlFor="firstName" className={label}>First name</label>
          <input id="firstName" value={firstName} maxLength={60} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={input} />
        </div>
        <div>
          <label htmlFor="lastName" className={label}>Last name</label>
          <input id="lastName" value={lastName} maxLength={60} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={input} />
        </div>
        <div>
          <label htmlFor="timeZone" className={label}>Your time zone</label>
          <div className="relative">
            <select id="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={`${input} cursor-pointer appearance-none pr-12`}>
              {!TIME_ZONES.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
              {TIME_ZONES.map((z) => <option key={z} value={z} className="bg-[#1f1f27]">{z}</option>)}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
        <ErrorText text={error} />
        <button type="submit" disabled={!dirty || busy} className={saveBtn(dirty && !busy)}>{busy ? "Saving…" : "Save"}</button>
      </form>
    </SubPage>
  );
}

function PasswordField({ id, title, value, onChange, autoComplete }: {
  id: string; title: string; value: string; onChange: (v: string) => void; autoComplete: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={label}>{title}</label>
      <div className="relative">
        <input id={id} type={shown ? "text" : "password"} required maxLength={72} placeholder="Password" value={value}
          onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${input} pr-14`} />
        <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
          {shown ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
}

function PasswordPage({ onBack, onToast }: { onBack: () => void; onToast: (m: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!current && !!next && !!repeat;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== repeat) return setError("The new passwords don't match.");
    setBusy(true); setError(null);
    try {
      await api.account.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setRepeat("");
      onToast("Password changed");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't change your password"); }
    finally { setBusy(false); }
  };

  return (
    <SubPage title="Change password" subtitle="You can set a new password for your account below." onBack={onBack}>
      <form onSubmit={save} className="space-y-6">
        <PasswordField id="current" title="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id="new" title="New password" value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordField id="repeat" title="Repeat password" value={repeat} onChange={setRepeat} autoComplete="new-password" />
        <ErrorText text={error} />
        <button type="submit" className={saveBtn(ready && !busy)}>{busy ? "Saving…" : "Save"}</button>
      </form>
      <div className="mt-6 border-t border-white/5 pt-6 text-center text-sm font-semibold text-white/80">
        Forgot password?{" "}
        <button type="button" onClick={() => onToast("Password reset by email isn't available yet.")} className="font-bold text-white underline">Click here</button>
      </div>
    </SubPage>
  );
}

function Switch({ on, onChange, name }: { on: boolean; onChange: (v: boolean) => void; name: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={name} onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-indigo-600" : "bg-white/15"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${on ? "left-7 bg-white" : "left-1 bg-white/75"}`} />
    </button>
  );
}

function ToggleRow({ title, on, onChange }: { title: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`${card} flex items-center justify-between px-5 py-4`}>
      <span className="font-semibold">{title}</span>
      <Switch on={on} onChange={onChange} name={title} />
    </div>
  );
}

const Section = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <section className="mt-1 first:mt-0">
    <h2 className="text-base font-semibold">{title}</h2>
    {sub && <p className="mt-1.5 text-xs font-semibold text-white/70">{sub}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

function NotificationsPage({ kind, profile, onBack, onChange, onToast }: {
  kind: "email" | "app"; profile: ProfileData; onBack: () => void; onChange: (p: ProfileData) => void; onToast: (m: string) => void;
}) {
  const email = kind === "email";
  const offersKey: keyof NotificationPrefs = email ? "emailSpecialOffers" : "appSpecialOffers";
  const learningKey: keyof NotificationPrefs = email ? "emailLearning" : "appLearning";
  const n = profile.notifications;
  const learningTitle = email ? "Learning emails" : "Learning notifications";

  // the switch moves straight away; if the server refuses, it moves back
  const update = async (patch: Partial<NotificationPrefs>) => {
    onChange({ ...profile, notifications: { ...n, ...patch } });
    try { onChange(await api.account.saveNotifications(patch)); }
    catch (e) { onChange(profile); onToast(e instanceof Error ? e.message : "Couldn't save"); }
  };

  return (
    <SubPage title={email ? "Email notifications" : "App notifications"} subtitle={email ? "Manage your email notifications." : "Manage your app notifications."} onBack={onBack}>
      <div className="space-y-8">
        <Section title="Special offers" sub="Receive special offers and new feature announcements.">
          <ToggleRow title="Special offers" on={n[offersKey]} onChange={(v) => update({ [offersKey]: v } as Partial<NotificationPrefs>)} />
        </Section>
        <Section title={learningTitle} sub="Stay on top of your language learning journey. Receive study reminders, practice summaries, and learning tips.">
          <ToggleRow title={learningTitle} on={n[learningKey]} onChange={(v) => update({ [learningKey]: v } as Partial<NotificationPrefs>)} />
        </Section>
      </div>
      <div className="mt-8 text-center">
        <button onClick={() => update({ [offersKey]: false, [learningKey]: false } as Partial<NotificationPrefs>)} className="text-sm font-semibold underline hover:text-white/80">Unsubscribe from all</button>
      </div>
    </SubPage>
  );
}

function PrivacyPage({ profile, onBack, onChange, onToast }: {
  profile: ProfileData; onBack: () => void; onChange: (p: ProfileData) => void; onToast: (m: string) => void;
}) {
  const update = async (patch: Partial<PrivacyPrefs>) => {
    onChange({ ...profile, privacy: { ...profile.privacy, ...patch } });
    try { onChange(await api.account.savePrivacy(patch)); }
    catch (e) { onChange(profile); onToast(e instanceof Error ? e.message : "Couldn't save"); }
  };

  return (
    <SubPage title="Privacy preferences" subtitle="Manage your privacy preferences." onBack={onBack}>
      <div className="space-y-8">
        <Section title="AI training">
          <ToggleRow title="Opt out of AI training" on={profile.privacy.optOutAiTraining} onChange={(v) => update({ optOutAiTraining: v })} />
        </Section>
        <Section title="Profiling">
          <ToggleRow title="Opt out of profiling" on={profile.privacy.optOutProfiling} onChange={(v) => update({ optOutProfiling: v })} />
        </Section>
      </div>
    </SubPage>
  );
}
