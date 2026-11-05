"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell, authButton, authInput, authLabel } from "@/components/AuthShell";
import { ErrorText } from "@/components/Modal";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // read the ?token= from the emailed link on the client (avoids a Suspense boundary for useSearchParams)
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") ?? ""), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !token) return;
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError(null);
    try {
      await api.auth.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (token === null) return null;
  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <div>
          <p className="rounded-lg bg-violet-500/15 px-3 py-3 text-sm text-violet-200">Your password has been changed.</p>
          <Link href="/login" className="mt-5 block rounded-lg bg-violet-600 py-3 text-center text-sm font-semibold hover:bg-violet-500">Sign in</Link>
        </div>
      ) : !token ? (
        <p className="text-sm text-white/70">This link is missing its token. <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300">Request a new one</Link>.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={authLabel} htmlFor="password">New password</label>
            <input id="password" type="password" required minLength={8} maxLength={72} placeholder="8+ characters" className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className={authLabel} htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" required minLength={8} maxLength={72} className={authInput} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <ErrorText text={error} />
          <button disabled={busy} className={authButton}>{busy ? "Please wait…" : "Change password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
