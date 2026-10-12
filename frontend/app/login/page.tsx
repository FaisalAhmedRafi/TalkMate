"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/Modal";
import { api, clearToken, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => clearToken(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { token } =
        mode === "login"
          ? await api.auth.login({ email, password })
          : await api.auth.register({ email, password, name: name.trim() || undefined });
      setToken(token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#16161c] p-4 text-white">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1f1f27] p-6">
        <p className="text-sm font-bold tracking-tight text-white/60">TalkMate</p>
        <h1 className="mt-1 text-xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h1>
        <div className="mt-5 space-y-3">
          {mode === "register" && (
            <input className={input} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          )}
          <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className={input} type="password" required minLength={mode === "register" ? 8 : undefined} placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        <ErrorText text={error} />
        <button disabled={busy} className="mt-5 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          className="mt-4 w-full text-center text-sm text-white/60 hover:text-white">
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </form>
    </main>
  );
}
