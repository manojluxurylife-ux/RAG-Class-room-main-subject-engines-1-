/**
 * subscription-policy — the grace-and-degrade dunning policy, in one
 * place so the student gate, the lazy reconciler, and the admin portal
 * can never disagree about what "not paying" means.
 *
 * The policy (chosen because students BYOK their own Gemini keys, so a
 * non-paying student costs ~nothing — there is no reason to be harsh):
 *   Day 0        period ends unpaid → status past_due. Nothing visible
 *                changes for the student yet.
 *   Days 0–7     GRACE — full access + a polite renew notice to the
 *                parent (never guilt shown to the child).
 *   Day 8+       DEGRADED — premium surfaces lock behind a friendly
 *                renew card (Study Materials generation, Exam Room,
 *                Practice, Library). Core keeps working: Classroom with
 *                their own key, offline Local Brain, everything already
 *                generated. Data is never touched.
 *   Any day      one recorded payment restores everything instantly
 *                (recordPayment/markPaymentPaid already clear past_due).
 *   Day 60       unpaid → cancelled, for honest MRR/churn numbers. The
 *                account stays intact; reactivation works months later.
 *
 * EXAM FREEZE: during Kerala/CBSE board-exam season (Feb 1 – Mar 31)
 * the DEGRADE and AUTO-CANCEL steps are suspended — a child sitting
 * SSLC exams never loses features mid-exam over a pending payment.
 * Grace notices still go out; collection pressure just pauses.
 */
import type { SubscriptionRecord } from "@/lib/subscriptions-store";

export const GRACE_DAYS = 7;
export const CANCEL_AFTER_DAYS = 60;

/** Months (1-based) where degrade/auto-cancel are suspended. */
export const EXAM_FREEZE_MONTHS = [2, 3]; // Feb, Mar

export type AccessLevel = "full" | "grace" | "degraded";

export interface AccessInfo {
  level: AccessLevel;
  status: string;            // underlying subscription status ("none" if no record)
  planName?: string;
  periodEnd?: string;
  graceEndsAt?: string;      // when grace turns into degraded (if in grace)
  examFreeze: boolean;       // true = degrade currently suspended by exam season
}

export function isExamFreeze(now = new Date()): boolean {
  return EXAM_FREEZE_MONTHS.includes(now.getMonth() + 1);
}

/**
 * Pure access computation — no I/O, fully testable.
 * `sub` is the student's subscription AFTER lazy reconciliation
 * (see subscriptionsStore.reconcile), or null if they never subscribed.
 */
export function computeAccess(sub: SubscriptionRecord | null, now = new Date()): AccessInfo {
  const freeze = isExamFreeze(now);

  // Never subscribed → free tier: premium locked, core open. Same
  // surface as "degraded", but reported honestly as its own status.
  if (!sub) return { level: "degraded", status: "none", examFreeze: freeze };

  if (sub.status === "active" || sub.status === "trialing") {
    return { level: "full", status: sub.status, planName: sub.plan, periodEnd: sub.currentPeriodEnd, examFreeze: freeze };
  }

  if (sub.status === "past_due") {
    const periodEnd = new Date(sub.currentPeriodEnd);
    const graceEnd  = new Date(periodEnd.getTime() + GRACE_DAYS * 86400_000);
    const inGrace   = now.getTime() <= graceEnd.getTime();
    // Exam freeze holds the line at grace — features stay open even
    // past day 7 while board exams are running.
    const level: AccessLevel = inGrace || freeze ? "grace" : "degraded";
    return {
      level, status: sub.status, planName: sub.plan,
      periodEnd: sub.currentPeriodEnd, graceEndsAt: graceEnd.toISOString(),
      examFreeze: freeze,
    };
  }

  // paused / cancelled / completed → premium locked, core open.
  return { level: "degraded", status: sub.status, planName: sub.plan, periodEnd: sub.currentPeriodEnd, examFreeze: freeze };
}
