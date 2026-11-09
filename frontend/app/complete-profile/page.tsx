"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { CountryPicker } from "@/components/CountryPicker";
import { ErrorText } from "@/components/Modal";
import { api, clearToken, getToken } from "@/lib/api";
import { countryByCode, mainCountry } from "@/lib/countries";
import { checkPhone } from "@/lib/phone";

const COUNTRY_ERROR = "Please select your country.";

// Shown after a Google sign-in when the account has no country / phone number yet. Nothing else can be opened until they are saved.
export default function CompleteProfilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<CountryCode | null>(null);
  const [dial, setDial] = useState<CountryCode | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialPicked = useRef(false);
  const phoneInput = useRef<HTMLInputElement>(null);

  // not signed in -> login; details already saved -> dashboard
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.account.profile()
      .then((p) => {
        if (p.country && p.phone) { router.replace("/dashboard"); return; }
        setEmail(p.email);
        setReady(true);
      })
      .catch((e) => { setError(e instanceof Error ? e.message : "Something went wrong"); setReady(true); });
  }, [router]);

  const phoneCheck = checkPhone(phone, dial);
  const pickCountry = (c: CountryCode) => {
    setCountry(c);
    if (!dialPicked.current) setDial(c); // the calling code follows the country until the person picks another
    setError((m) => (m === COUNTRY_ERROR ? null : m));
  };
  const pickDial = (c: CountryCode) => { dialPicked.current = true; setDial(c); phoneInput.current?.focus(); };
  const phoneBlur = () => {
    setPhoneTouched(true);
    if (!phoneCheck.ok) return;
    if (phone.trim().startsWith("+")) {
      const code = parsePhoneNumberFromString(phoneCheck.e164)?.countryCallingCode;
      if (code && (!dial || countryByCode(dial)?.dial !== code)) { dialPicked.current = true; setDial(mainCountry(code) ?? phoneCheck.country ?? null); }
    }
    setPhone(phoneCheck.national);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTriedSubmit(true);
    if (!country) { setError(COUNTRY_ERROR); return; }
    if (!phoneCheck.ok) { setPhoneTouched(true); phoneInput.current?.focus(); return; }
    setBusy(true); setError(null);
    try {
      await api.account.saveContact({ country, phone: phoneCheck.e164 });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  const logout = () => { clearToken(); router.replace("/login"); };

  if (!ready) return null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#140e33] p-4 text-white">
      <style>{"html { font-size: 110%; }"}</style>
      <form onSubmit={submit} className="w-full max-w-[460px]">
        <div className="mb-4 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-mark.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <p className="text-xl font-bold tracking-tight">Talk<span className="text-violet-300">Mate</span></p>
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">One last <span className="text-violet-400">step</span></h1>
        <p className="mt-2 text-sm text-white/70">
          Add your country and phone number to finish setting up your account{email ? <> (<b className="text-white/90">{email}</b>)</> : null}.
        </p>

        <div className="mt-5 space-y-2.5">
          <CountryPicker variant="country" compact ariaLabel="Country" placeholder="Country" value={country} onChange={pickCountry} invalid={triedSubmit && !country} />
          <div>
            <div className={`flex min-w-0 items-stretch rounded-2xl border bg-white/5 transition-colors focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/30 ${phoneTouched && !phoneCheck.ok ? "border-red-400/60" : "border-white/15"}`}>
              <CountryPicker variant="dial" compact ariaLabel="Phone country code" value={dial} onChange={pickDial} returnFocus={false} className="flex shrink-0 border-r border-white/15" />
              <input id="phone" ref={phoneInput} aria-label="Phone number" aria-invalid={phoneTouched && !phoneCheck.ok} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Phone Number" required maxLength={20} value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s().-]/g, ""))} onBlur={phoneBlur}
                className="min-w-0 flex-1 bg-transparent py-2.5 pl-3 pr-2 text-sm text-white outline-none placeholder:text-white/45" />
              {phoneCheck.ok && <Check size={18} aria-label="Valid phone number" className="my-auto mr-3 shrink-0 text-emerald-400" />}
            </div>
            {phoneTouched && !phoneCheck.ok && <p role="alert" className="mt-1.5 px-1 text-xs text-red-300">{phoneCheck.message}</p>}
          </div>
        </div>

        <ErrorText text={error} />

        <button disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#7c4dff] py-3 text-base font-semibold shadow-[0_8px_24px_rgba(124,77,255,0.35)] hover:bg-[#8f68ff] disabled:opacity-50">
          {busy ? "Please wait…" : <>Continue <ArrowRight size={20} /></>}
        </button>
        <button type="button" onClick={logout} className="mt-3 block w-full text-center text-sm text-white/60 hover:text-white">Use a different account</button>
      </form>
    </main>
  );
}
