"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/Modal";
import { api, clearToken, setToken } from "@/lib/api";
import { PASSWORD_HINT, passwordError } from "@/lib/password";

// Put your two illustrations in frontend/public/login/ (or change these paths)
const ART_LEFT = "/login/illustration-left.svg";
const ART_RIGHT = "/login/illustration-right.svg";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0); // seconds until another code may be requested
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | undefined>();
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [remember, setRemember] = useState(false);
  const googleBtn = useRef<HTMLDivElement>(null);
  // the Google callback is registered once, so it reads the latest values through a ref
  const latest = useRef({ ref, remember });
  latest.current = { ref, remember };

  useEffect(() => clearToken(), []);

  // an invite link looks like /login?ref=ABC123: open the sign-up form with the code
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) { setRef(r); setMode("register"); }
  }, []);

  // after sign-up (or a login that says the email is unverified) the user types the 6-digit code we emailed
  const goVerify = (message?: string) => {
    setMode("verify"); setCode(""); setError(null); setInfo(message ?? null); setResendIn(60);
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const resend = async () => {
    if (resendIn > 0) return;
    setError(null); setInfo(null);
    try {
      await api.auth.resendVerification(email);
      setInfo("A new code is on its way.");
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === "register" && (!firstName.trim() || !lastName.trim())) {
      setError("Please enter your first name and last name.");
      return;
    }
    const weak = mode === "register" ? passwordError(password) : null;
    if (weak) { setError(weak); return; }
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === "register") {
        await api.auth.register({ email, password, firstName: firstName.trim(), lastName: lastName.trim(), referralCode: ref, remember });
        setBusy(false);
        goVerify();
        return;
      }
      const { token } =
        mode === "verify"
          ? await api.auth.verifyEmail({ email, code, remember })
          : await api.auth.login({ email, password, remember });
      setToken(token, remember);
      router.replace("/dashboard");
    } catch (err) {
      if (mode === "login" && (err as { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        goVerify("Your email isn't verified yet. Enter the code we emailed you.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setBusy(false);
    }
  };

  // Google Identity Services draws the button and hands back an ID token, which the backend verifies
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const init = () => {
      const g = (window as any).google?.accounts?.id;
      if (!g || !googleBtn.current) return;
      g.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          setBusy(true); setError(null);
          try {
            const { token } = await api.auth.google({ credential: resp.credential, referralCode: latest.current.ref, remember: latest.current.remember });
            setToken(token, latest.current.remember);
            router.replace("/dashboard");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign-in failed");
            setBusy(false);
          }
        },
      });
      g.renderButton(googleBtn.current, { theme: "filled_black", size: "large", shape: "rectangular", text: "signin_with", width: 320 });
    };
    if ((window as any).google?.accounts?.id) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [router]);

  const label = "mb-1.5 block text-xs font-medium text-white/70";
  const input = "w-full rounded-lg border border-white/15 bg-[#16161c] px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40";
  const switchMode = () => { setMode(mode === "login" ? "register" : "login"); setError(null); };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e12] p-4 text-white">
      <div className="flex w-full max-w-5xl items-center justify-center gap-10">
        {/* a missing file hides itself, but keeps the space so the card stays centered */}
        <div className="hidden flex-1 justify-end lg:flex">
          {showLeft && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ART_LEFT} alt="" onError={() => setShowLeft(false)} className="max-h-[420px] w-full max-w-xs object-contain" />
          )}
        </div>

        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1f1f27] p-8 shadow-2xl">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            <p className="text-base font-bold tracking-tight text-white/80">TalkMate</p>
          </div>

          <h1 className="mt-6 text-2xl font-semibold">
            {mode === "login" ? "Welcome to TalkMate." : mode === "register" ? "Create your account" : "Verify your email"}
          </h1>
          {mode === "verify" ? (
            <p className="mt-1 text-sm text-white/60">We sent a 6-digit code to <b className="text-white/80">{email}</b>. It can take a minute to arrive, so check your spam folder too.</p>
          ) : (
          <p className="mt-1 text-sm text-white/60">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button type="button" onClick={switchMode} className="font-medium text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline">
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
            .
          </p>
          )}
          {ref && mode === "register" && <p className="mt-2 text-xs text-white/60">Invite code <b>{ref}</b> applied.</p>}

          {mode !== "verify" && (
          <div className="mt-6 space-y-4">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="firstName">First name</label>
                  <input id="firstName" className={input} required maxLength={60} value={firstName}
                    onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <label className={label} htmlFor="lastName">Last name</label>
                  <input id="lastName" className={input} required maxLength={60} value={lastName}
                    onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
              </div>
            )}
            <div>
              <label className={label} htmlFor="email">Email</label>
              <input id="email" className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-white/70" htmlFor="password">Password</label>
                {mode === "login" && <Link href="/forgot-password" className="text-xs font-medium text-violet-400 hover:text-violet-300">Forgot your password?</Link>}
              </div>
              <input id="password" className={input} type="password" required minLength={mode === "register" ? 8 : undefined}
                placeholder={mode === "register" ? "8+ characters" : undefined}
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "register" && <p className="mt-1.5 text-xs text-white/50">{PASSWORD_HINT}</p>}
            </div>
          </div>
          )}
          {mode === "verify" && (
            <div className="mt-6">
              <label className={label} htmlFor="code">6-digit code</label>
              <input id="code" className={`${input} text-center text-2xl tracking-[0.5em]`} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus
                autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}

          {mode !== "verify" && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            Remember this device
          </label>
          )}

          <ErrorText text={error} />
          {info && <p role="status" className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{info}</p>}

          <button disabled={busy} className="mt-6 w-full rounded-lg bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Verify and continue"}
          </button>

          {mode === "verify" && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" onClick={resend} disabled={resendIn > 0} className="font-medium text-violet-400 hover:text-violet-300 disabled:text-white/40">
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button type="button" onClick={() => { setMode("register"); setError(null); setInfo(null); }} className="text-white/60 hover:text-white">
                Use a different email
              </button>
            </div>
          )}

          {/* kept mounted (just hidden) so the Google button is not lost when the verify step opens */}
          <div className={mode === "verify" ? "hidden" : ""}>
          <div className="my-5 flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            or sign in with
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div ref={googleBtn} className="flex min-h-[44px] justify-center" />
          ) : (
            <p className="text-center text-xs text-white/40">Google sign-in needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (see CLAUDE.md).</p>
          )}
          </div>
        </form>

        <div className="hidden flex-1 justify-start lg:flex">
          {showRight && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ART_RIGHT} alt="" onError={() => setShowRight(false)} className="max-h-[420px] w-full max-w-xs object-contain" />
          )}
        </div>
      </div>
    </main>
  );
}
