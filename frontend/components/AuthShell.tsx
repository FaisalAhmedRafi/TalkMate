import Link from "next/link";

// Dark card used by the forgot / reset password pages (the login page has its own layout with the illustration)
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e12] p-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1f1f27] p-8 shadow-2xl">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          <p className="text-base font-bold tracking-tight text-white/80">TalkMate</p>
        </div>
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        <Link href="/login" className="mt-5 block text-center text-sm text-violet-400 hover:text-violet-300">Back to sign in</Link>
      </div>
    </main>
  );
}

export const authInput = "w-full rounded-lg border border-white/15 bg-[#16161c] px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40";
export const authLabel = "mb-1.5 block text-xs font-medium text-white/70";
export const authButton = "w-full rounded-lg bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50";
