"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/Modal";
import { api, clearToken, setToken } from "@/lib/api";
import { passwordError } from "@/lib/password";

// The left illustration is split into layers (frontend/public/login/robot/) so the robot can move:
// base = the whole picture without the head, head, eyes, smile. Coordinates are in the 1306x1205 picture.
const ROBOT = "/login/robot";
const ROBOT_CSS = `
@keyframes tm-nod { 0%,100% { transform: translateY(0) rotate(0deg); } 30% { transform: translateY(12px) rotate(-1.6deg); } 65% { transform: translateY(5px) rotate(1.2deg); } }
@keyframes tm-blink { 0%,86%,100% { transform: scaleY(1); } 90% { transform: scaleY(0.08); } 94% { transform: scaleY(1); } 96% { transform: scaleY(0.08); } 98% { transform: scaleY(1); } }
@keyframes tm-glow { 0%,100% { filter: drop-shadow(0 0 3px rgba(60,140,255,.7)); } 50% { filter: drop-shadow(0 0 9px rgba(90,200,255,.95)); } }
.tm-head { transform-box: view-box; transform-origin: 985px 808px; animation: tm-nod 5s ease-in-out infinite; }
.tm-eyes { transform-box: view-box; transform-origin: 929px 663px; animation: tm-blink 5s ease-in-out infinite, tm-glow 2.6s ease-in-out infinite; }
.tm-smile { animation: tm-glow 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .tm-head, .tm-eyes, .tm-smile { animation: none; } }
`;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0); // seconds until another code may be requested
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | undefined>();
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
    if (mode === "register" && password !== confirm) { setError("The two passwords don't match."); return; }
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

  // The official Google button is drawn at 400x40 (its largest size) and stretched to fill the styled button above it
  const fitGoogle = () => {
    const el = googleBtn.current;
    const box = el?.parentElement;
    if (!el || !box || !box.offsetWidth) return;
    el.style.transform = `scale(${box.offsetWidth / 400}, ${box.offsetHeight / 40})`;
  };
  const drawGoogle = () => {
    const g = (window as any).google?.accounts?.id;
    const el = googleBtn.current;
    if (!g || !el) return;
    el.innerHTML = "";
    g.renderButton(el, { theme: "outline", size: "large", shape: "rectangular", text: "signin_with", width: 400 });
    fitGoogle();
  };
  useEffect(() => {
    window.addEventListener("resize", fitGoogle);
    return () => window.removeEventListener("resize", fitGoogle);
  }, []);

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
      drawGoogle();
    };
    if ((window as any).google?.accounts?.id) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [router]);

  // redraw after the verify step (where the button is hidden) or a mode change
  useEffect(() => {
    if (GOOGLE_CLIENT_ID && mode !== "verify") drawGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const login = mode === "login";
  const register = mode === "register";
  const input = "w-full rounded-2xl border border-white/15 bg-white/5 py-3.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/45 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30";
  const switchMode = () => { setMode(login ? "register" : "login"); setError(null); setConfirm(""); setShowPassword(false); setShowConfirm(false); };
  const eye = (shown: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} aria-label={shown ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
      {shown ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
  const brand = <>Talk<span className="text-violet-300">Mate</span></>;
  const fade = "linear-gradient(to bottom, black 92%, transparent 100%)";

  return (
    <main className="min-h-screen bg-[#140e33] text-white">
      {/* same as browser zoom 110%: scales every rem size (text, spacing) on this page only; removed when leaving the page */}
      <style>{"html { font-size: 110%; }"}</style>
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        {/* left: the same on login and register, only the right side changes */}
        <section className="relative hidden min-h-screen overflow-hidden bg-[#4a13c0] lg:block">
          <style>{ROBOT_CSS}</style>
          {/* "slice" keeps the picture covering the area like object-cover, so the layers stay lined up at any size */}
          <svg viewBox="0 0 1306 1205" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-x-0 top-0 h-[74%] w-full" style={{ maskImage: fade, WebkitMaskImage: fade }}>
            <image href={`${ROBOT}/base.webp`} width="1306" height="1205" />
            <g className="tm-head">
              <image href={`${ROBOT}/head.webp`} x="754" y="518" width="447" height="297" />
              <image className="tm-eyes" href={`${ROBOT}/eyes.webp`} x="834" y="638" width="191" height="50" />
              <image className="tm-smile" href={`${ROBOT}/smile.webp`} x="895" y="694" width="57" height="30" />
            </g>
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#1c0861] via-[#2c0e8f]/70 to-transparent" />
          <div className="absolute left-7 top-6 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo-mark.png" alt="" width={57} height={57} className="h-[57px] w-[57px] object-contain" />
            <p className="text-3xl font-bold tracking-tight">{brand}</p>
          </div>
          <div className="absolute inset-x-8 bottom-8">
            <h2 className="text-4xl font-bold leading-tight">Learn Languages<br />with <span className="text-violet-300">TalkMate</span></h2>
            <p className="mt-3 text-lg leading-snug text-white/75">Practice. Speak. Improve.<br />Anytime, Anywhere.</p>
          </div>
        </section>

        {/* right: login / register / verify */}
        <section className="flex min-h-screen items-center justify-center bg-[#140e33] px-6 py-10 lg:px-16">
          <form onSubmit={submit} className="w-full max-w-[460px]">
            <div className="mb-5 flex items-center gap-2 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/logo-mark.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
              <p className="text-xl font-bold tracking-tight">{brand}</p>
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              {login ? <>Welcome <span className="text-violet-400">back</span></> : register ? <>Create an <span className="text-violet-400">account</span></> : <>Verify your <span className="text-violet-400">email</span></>}
            </h1>
            <p className="mt-2 text-sm text-white/70">
              {login ? <>Log in to continue your language learning journey with <b className="font-semibold text-violet-400">TalkMate</b>.</>
                : register ? <>Start your language learning journey with <b className="font-semibold text-violet-400">TalkMate</b>.</>
                : <>We sent a 6-digit code to <b className="text-white/90">{email}</b>. It can take a minute to arrive, so check your spam folder too.</>}
            </p>
            {ref && register && <p className="mt-2 text-xs text-white/60">Invite code <b>{ref}</b> applied.</p>}

            {mode !== "verify" && (
              <div className="mt-6 space-y-3">
                {register && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field icon={User}>
                      <input id="firstName" aria-label="First name" className={input} placeholder="First Name" required maxLength={60} value={firstName}
                        onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    </Field>
                    <Field icon={User}>
                      <input id="lastName" aria-label="Last name" className={input} placeholder="Last Name" required maxLength={60} value={lastName}
                        onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                    </Field>
                  </div>
                )}
                <Field icon={Mail}>
                  <input id="email" aria-label="Email" className={input} type="email" placeholder="Email Address" required value={email}
                    onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                {register ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field icon={Lock}>
                        <input id="password" aria-label="Password" className={`${input} pr-10`} type="password" placeholder="Create Password" required minLength={8} maxLength={72}
                          value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                      </Field>
                      <Field icon={Lock}>
                        <input id="confirm" aria-label="Confirm password" className={`${input} pr-10`} type="password" placeholder="Confirm Password" required minLength={8} maxLength={72}
                          value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                      </Field>
                    </div>
                    <p className="text-xs leading-tight text-white/50">Use minimum 8 characters with upper and lowercase letters and a number.</p>
                  </>
                ) : (
                  <Field icon={Lock} right={eye(showPassword, () => setShowPassword((v) => !v))}>
                    <input id="password" aria-label="Password" className={`${input} pr-10`} type={showPassword ? "text" : "password"} placeholder="Password" required maxLength={72}
                      value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </Field>
                )}
              </div>
            )}
            {mode === "verify" && (
              <div className="mt-6">
                <input id="code" aria-label="6-digit code" className={`${input} pl-4 text-center text-2xl tracking-[0.5em] placeholder:text-sm placeholder:tracking-normal`} placeholder="6-digit code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus
                  autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}

            {mode !== "verify" && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/75">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 rounded accent-violet-500" />
                  Remember this device
                </label>
                {login && <Link href="/forgot-password" className="text-sm font-medium text-violet-400 hover:text-violet-300">Forgot your password?</Link>}
              </div>
            )}

            <ErrorText text={error} />
            {info && <p role="status" className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{info}</p>}

            <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#7c4dff] py-3.5 text-base font-semibold shadow-[0_8px_24px_rgba(124,77,255,0.35)] hover:bg-[#8f68ff] disabled:opacity-50">
              {busy ? "Please wait…" : <>{login ? "Sign in" : register ? "Create Account" : "Verify and continue"} <ArrowRight size={20} /></>}
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
              <div className="my-4 flex items-center gap-3 text-xs text-white/50">
                <span className="h-px flex-1 bg-white/15" />
                {login ? "or sign in with" : "or sign up with"}
                <span className="h-px flex-1 bg-white/15" />
              </div>

              {GOOGLE_CLIENT_ID ? (
                // the official Google button (needed to get the ID token) sits invisibly on top of a styled button, so clicks still go to Google
                <div className="group relative h-[57px] w-full">
                  <div className="pointer-events-none flex h-full w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/50 bg-white/[0.03] text-sm font-medium text-white/90 transition group-hover:bg-violet-500/10">
                    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    Google
                  </div>
                  <div ref={googleBtn} className="absolute left-0 top-0 origin-top-left overflow-hidden opacity-[0.01]" style={{ width: 400, height: 40 }} />
                </div>
              ) : (
                <p className="text-center text-xs text-white/40">Google sign-in needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (see CLAUDE.md).</p>
              )}

              <p className="mt-5 text-center text-sm text-white/60">
                {login ? "New here? " : "Already have an account? "}
                <button type="button" onClick={switchMode} className="font-semibold text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline">
                  {login ? "Create an account" : "Log in"}
                </button>
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

// an input with an icon on its left (and optionally a control on its right, e.g. the show-password eye)
function Field({ icon: Icon, right, children }: { icon: LucideIcon; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
      {children}
      {right}
    </div>
  );
}
