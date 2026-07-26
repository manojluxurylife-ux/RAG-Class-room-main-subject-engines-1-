"use client";
/**
 * SubscriptionGate — the client side of the dunning flow.
 *
 *  useSubscriptionAccess()  — fetches /api/student/subscription once per
 *                             10 minutes (sessionStorage cache) so the
 *                             gate never adds a per-page network wait.
 *  <SubscriptionNotice/>    — slim amber banner under the main menu
 *                             during GRACE ("renew to keep premium…").
 *  <PremiumGate feature=…>  — wraps a premium page; renders children on
 *                             full/grace, a friendly renew card when
 *                             DEGRADED. The card never threatens: it
 *                             names what still works (Classroom, offline
 *                             brain, everything already made) and points
 *                             at Messages, where the renew reminder
 *                             thread already lives.
 */
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { safeStringify } from "@/lib/safe-storage";
import { Lock, MessageCircle, Sparkles } from "lucide-react";
import { studentSession } from "@/lib/student-session";

export interface Access {
  level: "full" | "grace" | "degraded";
  status: string;
  planName?: string;
  periodEnd?: string;
  graceEndsAt?: string;
  examFreeze?: boolean;
  enforced?: boolean;
  wouldBe?: string;
}

const CACHE_KEY = "gg_sub_access";
const CACHE_MS  = 10 * 60 * 1000;

export function useSubscriptionAccess(): { access: Access | null; loading: boolean } {
  const [access, setAccess]   = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profile = studentSession.get();
    if (!profile) { setLoading(false); return; }

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { at, data } = JSON.parse(cached);
        if (Date.now() - at < CACHE_MS) { setAccess(data); setLoading(false); return; }
      }
    } catch { /* cache is an optimisation, never a requirement */ }

    fetch(`/api/student/subscription?studentId=${encodeURIComponent(profile.email)}`)
      .then(r => r.json())
      .then(data => {
        setAccess(data);
        try {
          sessionStorage.setItem(CACHE_KEY, safeStringify({ at: Date.now(), data }));
        } catch (e) {
          console.error("SubscriptionGate JSON.stringify failed, data:", data, "error:", e);
        }
      })
      .catch(() => setAccess(null)) // gate fails OPEN — a network blip must never lock a student out
      .finally(() => setLoading(false));
  }, []);

  return { access, loading };
}

/** Slim banner under the main menu during the grace window. */
export function SubscriptionNotice() {
  const { access } = useSubscriptionAccess();
  if (!access || access.level !== "grace") return null;
  const daysLeft = access.graceEndsAt
    ? Math.max(0, Math.ceil((new Date(access.graceEndsAt).getTime() - Date.now()) / 86400_000))
    : null;
  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-marigold/40 bg-marigold/10 px-3.5 py-2.5 text-xs text-chalkdim">
      <b className="text-marigold">Your plan has ended.</b> Everything still works
      {access.examFreeze
        ? " — and nothing will be locked during exam season."
        : daysLeft !== null
          ? ` for ${daysLeft} more day${daysLeft !== 1 ? "s" : ""}.`
          : "."}{" "}
      Ask your parent to renew (Monthly ₹599 · Yearly ₹5,000) —{" "}
      <Link href="/messages" className="text-marigold underline underline-offset-2">details in Messages</Link>.
    </div>
  );
}

/** Wrap a premium page. Full/grace → the page. Degraded → the renew card. */
export function PremiumGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { access, loading } = useSubscriptionAccess();

  // Loading, no session, or fetch failure → open. The gate exists to
  // nudge payment, not to add a failure mode to a child's study time.
  if (loading || !access || access.level !== "degraded") return <>{children}</>;

  return (
    <div className="rounded-2xl border border-board3 bg-board2 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-marigold/40 bg-marigold/10 text-marigold">
        <Lock size={20} />
      </div>
      <div className="mb-1 font-display text-lg text-chalk">{feature} needs an active plan</div>
      <p className="mx-auto mb-4 max-w-sm text-sm text-chalkdim leading-relaxed">
        {access.status === "none"
          ? <>Subscribe to unlock {feature} — <b className="text-chalk">Monthly ₹599</b> or <b className="text-chalk">Yearly ₹5,000</b>.</>
          : <>Your plan has ended. Renew — <b className="text-chalk">Monthly ₹599</b> or <b className="text-chalk">Yearly ₹5,000</b> — and this unlocks instantly.</>}
      </p>
      <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-chalkdim">
        <Sparkles size={12} className="text-marigold" />
        Your Classroom, offline brain, and everything you already made keep working — nothing is deleted.
      </div>
      <Link href="/messages"
        className="inline-flex items-center gap-2 rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim transition-colors">
        <MessageCircle size={15} /> Renew via Messages
      </Link>
    </div>
  );
}
