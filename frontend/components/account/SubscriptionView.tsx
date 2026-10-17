"use client";

import { useEffect, useState } from "react";
import { ChevronsRight, Star } from "lucide-react";
import { ErrorText, Modal } from "@/components/Modal";
import { api, type Progress, type SubscriptionInfo } from "@/lib/api";
import { SubPage } from "./SubPage";

const PLANS = [1, 3, 12, 24]; // months, same list as the backend
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const monthsLabel = (n: number) => `${n} ${n === 1 ? "Month" : "Months"}`;
const outline = "w-full rounded-2xl border border-white/10 py-5 text-sm font-semibold transition-colors hover:bg-white/5 disabled:opacity-50";

export function SubscriptionView({ onBack, onToast, onSnapshot }: {
  onBack: () => void; onToast: (message: string) => void; onSnapshot: (p: Progress) => void;
}) {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [months, setMonths] = useState(1);

  useEffect(() => {
    api.account.subscription().then(setSub).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your subscription"));
    api.progress.get().then(onSnapshot).catch(() => {}); // a plan that ran out may have switched Premium off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run one change, show the new state, and refresh the Premium flag in the app.
  const act = async (run: () => Promise<SubscriptionInfo>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await run();
      setSub(next);
      api.progress.get().then(onSnapshot).catch(() => {});
      onToast(done);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
      setPlanOpen(false);
      setCancelOpen(false);
    }
  };
  // The demo unlock starts a demo subscription on the server
  const start = () => act(async () => { onSnapshot(await api.progress.premium()); return api.account.subscription(); }, "Premium started (demo)");

  const status = sub?.status ?? "none";
  const endDate = sub?.nextPayment ?? sub?.accessUntil ?? null;

  return (
    <SubPage title="Subscriptions" subtitle="Manage your subscriptions below." onBack={onBack}>
      <ErrorText text={error} />
      {!sub && !error && <p className="text-center text-white/60">Loading…</p>}

      {sub && status === "none" && (
        <div className="mx-auto max-w-[400px] text-center">
          <p className="text-white/70">
            {sub.premium ? "Premium is on from the earlier demo unlock, so there is no plan to manage yet." : "You don't have a subscription."}
          </p>
          <button onClick={start} disabled={busy} className="mt-6 w-full rounded-full bg-pink-500 py-4 text-sm font-semibold hover:bg-pink-400 disabled:opacity-50">
            {busy ? "Please wait…" : "Get Premium (demo)"}
          </button>
        </div>
      )}

      {sub && status !== "none" && (
        <div className="mx-auto max-w-[400px]">
          <div className="relative flex h-[250px] flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#d92a6c] to-[#c41f5e] p-6">
            <ChevronsRight aria-hidden size={230} strokeWidth={3} className="absolute -right-10 -top-2 text-white/10" />
            <span className="relative flex items-center gap-2 text-sm font-semibold"><Star size={14} fill="white" /> Premium</span>
            <p className="relative mt-1 text-3xl font-semibold">{monthsLabel(sub.months ?? 1)}</p>
            <p className="relative mt-6 text-xs text-white/70">
              {status === "active" && <>Next scheduled payment: <b className="text-white">{endDate && fmt(endDate)}</b></>}
              {status === "paused" && <>Paused. Access until: <b className="text-white">{endDate && fmt(endDate)}</b></>}
              {status === "canceled" && <>Cancelled. Access until: <b className="text-white">{endDate && fmt(endDate)}</b></>}
            </p>
            {status !== "canceled" && (
              <button onClick={() => { setMonths(sub.months ?? 1); setPlanOpen(true); }}
                className="relative mt-auto self-end rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">Change plan</button>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {status === "active" && <button className={outline} disabled={busy} onClick={() => act(api.account.pause, "Subscription paused")}>Pause subscription</button>}
            {status === "paused" && <button className={outline} disabled={busy} onClick={() => act(api.account.resume, "Subscription resumed")}>Resume subscription</button>}
            {status === "canceled" && <button className={outline} disabled={busy} onClick={start}>Resubscribe (demo)</button>}
            {status !== "canceled" && <button className={outline} disabled={busy} onClick={() => setCancelOpen(true)}>Cancel subscription</button>}
          </div>
          {status !== "canceled" && (
            <p className="mt-4 text-center text-[11px] font-semibold leading-4 text-white/70">
              If you cancel your subscription, you will lose access to all advanced modes and future premium updates.
            </p>
          )}
        </div>
      )}

      <div className="mx-auto mt-24 max-w-[320px] border-t border-white/10 pt-6 text-center text-[11px] font-semibold">
        You can update your payment method or view invoices{" "}
        <button onClick={() => onToast("Billing isn't connected yet")} className="underline">here</button>
        <p className="mt-2 font-normal text-white/50">Billing isn't connected yet, so changes here are for testing.</p>
      </div>

      {planOpen && (
        <Modal onClose={() => setPlanOpen(false)} label="Change plan">
          <h2 className="text-xl font-semibold">Change plan</h2>
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Plan length">
            {PLANS.map((m) => (
              <button key={m} role="radio" aria-checked={months === m} onClick={() => setMonths(m)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold ${months === m ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 hover:bg-white/5"}`}>
                {monthsLabel(m)}
                {months === m && <span className="h-3 w-3 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={() => act(() => api.account.changePlan(months), "Plan changed")}
            className="mt-5 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">Save plan</button>
        </Modal>
      )}

      {cancelOpen && (
        <Modal onClose={() => setCancelOpen(false)} label="Cancel subscription">
          <h2 className="text-xl font-semibold">Cancel subscription?</h2>
          <p className="mt-2 text-sm text-white/70">
            You keep Premium until {endDate ? fmt(endDate) : "the end of this period"}. After that you lose access to all advanced modes.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setCancelOpen(false)} className="flex-1 rounded-full bg-white/10 py-3 text-sm font-semibold hover:bg-white/20">Keep Premium</button>
            <button disabled={busy} onClick={() => act(api.account.cancel, "Subscription cancelled")}
              className="flex-1 rounded-full bg-pink-500 py-3 text-sm font-semibold hover:bg-pink-400 disabled:opacity-50">Cancel it</button>
          </div>
        </Modal>
      )}
    </SubPage>
  );
}
