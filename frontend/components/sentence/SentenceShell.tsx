"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, LayoutGrid, LogOut, TrendingUp } from "lucide-react";
import { clearToken } from "@/lib/api";

/** Always takes the learner back to the dashboard. */
export const Logo = () => (
  <Link href="/dashboard" aria-label="TalkMate home"
    className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 8l8 8-8 8M16 8l8 8-8 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="text-lg font-bold tracking-tight">TalkMate</span>
  </Link>
);

/** Sidebar + centred column used by the unit list and skill pages (the practice screen is full screen). */
export function SentenceShell({ title, backHref, children }: { title: string; backHref: string; children: React.ReactNode }) {
  const router = useRouter();
  const item = "flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/80 hover:bg-white/5";
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[236px] flex-col justify-between border-r border-white/5 bg-[#16161c] px-6 py-6 md:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          <Link href="/dashboard" className={item}><LayoutGrid size={18} /> Home</Link>
          <Link href="/dashboard?tab=learn" className={item}><BookOpen size={18} /> Learn</Link>
          <Link href="/dashboard?tab=progress" className={item}><TrendingUp size={18} /> Progress</Link>
        </nav>
        <button onClick={() => { clearToken(); router.replace("/login"); }} className={item}><LogOut size={18} /> Log out</button>
      </aside>
      <main className="w-full px-4 py-10 md:pl-[236px]">
        <div className="mx-auto w-full max-w-[660px]">
          <Link href={backHref} className="inline-flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft size={18} /> {title}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
