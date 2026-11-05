"use client";

import { useState } from "react";
import { AuthShell, authButton, authInput, authLabel } from "@/components/AuthShell";
import { ErrorText } from "@/components/Modal";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      {sent ? (
        <p className="rounded-lg bg-violet-500/15 px-3 py-3 text-sm text-violet-200">
          If an account exists for <b>{email}</b>, a reset link is on its way. It works for 1 hour.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label className={authLabel} htmlFor="email">Email</label>
          <input id="email" type="email" required className={authInput} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <ErrorText text={error} />
          <button disabled={busy} className={`mt-5 ${authButton}`}>{busy ? "Please wait…" : "Send reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}
