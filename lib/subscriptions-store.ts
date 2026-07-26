/**
 * Subscriptions / payments store — backed by Firestore.
 *
 * NOT WIRED TO REAL RAZORPAY YET — this schema is designed to match what
 * a Razorpay webhook payload gives you (order/payment IDs, amount, status),
 * so when billing goes live, /api/billing/webhook just needs to call
 * subscriptionsStore.create()/update() with real data instead of test data.
 * See README for the wiring checklist.
 */
import { collectionHelpers } from "./firestore-collection";

// Lifecycle adapted from Meteroid (meteroid-oss/meteroid,
// diesel-models/enums.rs SubscriptionStatusEnum). Their full enum has 11
// states because they bill enterprises with payment processors and
// dunning; scaled here to the six that mean something for a school app.
// Meteroid's Suspended (non-payment) maps to past_due here; their
// Superseded (upgrade/downgrade creates a new version) is simplified to
// an in-place plan change recorded in the movement ledger.
export type SubscriptionStatus =
  | "trialing"    // Meteroid: TrialActive
  | "active"      // Meteroid: Active
  | "past_due"    // Meteroid: Suspended / PendingCharge
  | "paused"      // Meteroid: Paused
  | "cancelled"   // Meteroid: Cancelled
  | "completed";  // Meteroid: Completed (ran its full term)
export type PlanId = string; // plan ids now come from the plans store

// MRR movement ledger — Meteroid's MrrMovementType, verbatim:
// NewBusiness / Expansion / Contraction / Churn / Reactivation. This is
// what turns "MRR is ₹X" into "MRR changed because of Y".
export type MrrMovementType = "new_business" | "expansion" | "contraction" | "churn" | "reactivation";
export interface MrrMovement {
  type: MrrMovementType;
  at: string;            // ISO
  deltaPaise: number;    // signed monthly delta
  note?: string;
}

/** One entry in a subscriber's payment history. "pending" covers both
 *  awaiting-payment invoices and offline promises ("will pay after
 *  salary day" is a real thing school billing must model honestly). */
export interface PaymentEntry {
  id:          string;
  at:          string;   // ISO — when recorded
  amountPaise: number;
  status:      "paid" | "pending";
  method?:     string;   // "razorpay" | "cash" | "bank transfer" | ...
  note?:       string;
  paidAt?:     string;   // ISO — set when a pending entry is marked paid
}

export interface SubscriptionRecord {
  id:              string;
  studentId:       string;
  studentEmail:    string;
  studentName:     string;
  plan:            PlanId;
  amountPaise:     number;    // Razorpay convention — smallest currency unit
  status:          SubscriptionStatus;
  razorpayOrderId?:string;
  razorpayPaymentId?: string;
  startedAt:       string;    // ISO date
  currentPeriodEnd:string;    // ISO date
  cancelledAt?:    string;
  cancelAtPeriodEnd?: boolean; // Meteroid-style graceful cancel: keep access until the paid period ends
  trialEndsAt?:    string;
  movements?:      MrrMovement[]; // MRR movement ledger, appended by every lifecycle action
  dunningNotifiedAt?: string;      // when the renew reminder was sent — sent ONCE per lapse, not daily
  payments?:       PaymentEntry[]; // full payment history, newest last
}

const col = collectionHelpers<SubscriptionRecord>("subscriptions");

/** Normalize any subscription to a monthly figure for MRR math. */
function monthlyPaise(s: SubscriptionRecord): number {
  return /annual/i.test(s.plan) ? Math.round(s.amountPaise / 12) : s.amountPaise;
}

export const PLAN_PRICES: Record<string, number> = {
  family_monthly: 59900,   // ₹599.00
  family_annual:  500000,  // ₹5,000.00
};

export const subscriptionsStore = {
  all: col.all,
  byId: col.byId,

  async byStudent(studentId: string): Promise<SubscriptionRecord[]> {
    return col.where("studentId", studentId);
  },

  create: col.create,
  update: col.update,

  // ── Lifecycle actions (Meteroid: "full lifecycle control") ──────────
  // Every action appends to the MRR movement ledger so revenue analytics
  // explain themselves instead of just changing.

  async cancel(id: string, when: "now" | "period_end" = "now") {
    const sub = await col.byId(id);
    if (!sub) return null;
    if (when === "period_end") {
      // Graceful cancel: the family keeps what they paid for; churn is
      // recorded now (the decision happened now) but access continues.
      return col.update(id, {
        cancelAtPeriodEnd: true,
        movements: [...(sub.movements || []), {
          type: "churn" as const, at: new Date().toISOString(),
          deltaPaise: -monthlyPaise(sub), note: "cancel at period end",
        }],
      });
    }
    return col.update(id, {
      status: "cancelled", cancelledAt: new Date().toISOString(), cancelAtPeriodEnd: false,
      movements: [...(sub.movements || []), {
        type: "churn" as const, at: new Date().toISOString(), deltaPaise: -monthlyPaise(sub),
      }],
    });
  },

  async pause(id: string) {
    return col.update(id, { status: "paused" });
  },

  async resume(id: string) {
    return col.update(id, { status: "active" });
  },

  async reactivate(id: string) {
    const sub = await col.byId(id);
    if (!sub) return null;
    return col.update(id, {
      status: "active", cancelledAt: undefined as any, cancelAtPeriodEnd: false,
      movements: [...(sub.movements || []), {
        type: "reactivation" as const, at: new Date().toISOString(), deltaPaise: monthlyPaise(sub),
      }],
    });
  },

  async extendTrial(id: string, days = 7) {
    const sub = await col.byId(id);
    if (!sub) return null;
    const base = sub.trialEndsAt ? new Date(sub.trialEndsAt) : new Date(sub.currentPeriodEnd);
    base.setDate(base.getDate() + days);
    return col.update(id, { status: "trialing", trialEndsAt: base.toISOString(), currentPeriodEnd: base.toISOString() });
  },

  /** Upgrade/downgrade — Meteroid supersedes the subscription with a new
   *  version; here it's an in-place change, with the price delta logged
   *  as expansion (up) or contraction (down). No proration — the new
   *  price applies from the next period, which is both simpler and the
   *  honest thing to display to a parent. */
  async changePlan(id: string, newPlan: string, newAmountPaise: number, interval: "monthly" | "annual") {
    const sub = await col.byId(id);
    if (!sub) return null;
    const oldMonthly = monthlyPaise(sub);
    const newMonthly = interval === "annual" ? newAmountPaise / 12 : newAmountPaise;
    const delta = Math.round(newMonthly - oldMonthly);
    return col.update(id, {
      plan: newPlan, amountPaise: newAmountPaise,
      movements: [...(sub.movements || []), {
        type: (delta >= 0 ? "expansion" : "contraction") as MrrMovementType,
        at: new Date().toISOString(), deltaPaise: delta,
        note: `plan change → ${newPlan}`,
      }],
    });
  },

  async byEmail(email: string): Promise<SubscriptionRecord | null> {
    const list = await col.where("studentEmail", email);
    if (list.length === 0) return null;
    // A student can have history (old cancelled + new active) — the most
    // recently started record is the one that governs access.
    return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  },

  /**
   * LAZY RECONCILER — the "no cron needed" part of the dunning flow.
   * Called whenever a subscription is read (student gate, admin list);
   * applies whatever time-based transitions are overdue:
   *   active|trialing + period ended + cancelAtPeriodEnd → cancelled
   *   active|trialing + period ended                     → past_due
   *   past_due + CANCEL_AFTER_DAYS elapsed               → cancelled (+churn)
   * Auto-cancel is suspended during the exam freeze (Feb–Mar) — see
   * lib/subscription-policy.ts for the whole policy in one place.
   */
  async reconcile(sub: SubscriptionRecord): Promise<SubscriptionRecord> {
    const { CANCEL_AFTER_DAYS, isExamFreeze } = await import("./subscription-policy");
    const now = Date.now();
    const periodEnd = new Date(sub.currentPeriodEnd).getTime();

    if ((sub.status === "active" || sub.status === "trialing") && now > periodEnd) {
      if (sub.cancelAtPeriodEnd) {
        // Churn was already logged when the cancel was scheduled.
        return (await col.update(sub.id, {
          status: "cancelled", cancelledAt: new Date().toISOString(), cancelAtPeriodEnd: false,
        }))!;
      }
      return (await col.update(sub.id, { status: "past_due" }))!;
    }

    if (sub.status === "past_due" && !isExamFreeze()) {
      const cancelAt = periodEnd + CANCEL_AFTER_DAYS * 86400_000;
      if (now > cancelAt) {
        return (await col.update(sub.id, {
          status: "cancelled", cancelledAt: new Date().toISOString(),
          movements: [...(sub.movements || []), {
            type: "churn" as const, at: new Date().toISOString(),
            deltaPaise: -monthlyPaise(sub), note: `auto-cancel after ${CANCEL_AFTER_DAYS}d unpaid`,
          }],
        }))!;
      }
    }
    return sub;
  },

  /** Reconcile the whole book — used by the admin list so statuses are
   *  true at read time even for students who never opened the app. */
  async reconcileAll(): Promise<SubscriptionRecord[]> {
    const subs = await col.all();
    return Promise.all(subs.map(s => subscriptionsStore.reconcile(s)));
  },

  async markDunningNotified(id: string) {
    return col.update(id, { dunningNotifiedAt: new Date().toISOString() });
  },

  // ── Payment history ─────────────────────────────────────────────────

  async recordPayment(id: string, entry: Omit<PaymentEntry, "id" | "at">) {
    const sub = await col.byId(id);
    if (!sub) return null;
    const payment: PaymentEntry = {
      ...entry,
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      paidAt: entry.status === "paid" ? new Date().toISOString() : undefined,
    };
    return col.update(id, {
      payments: [...(sub.payments || []), payment],
      // A recorded PAID payment on a past_due subscription clears it —
      // the money arrived, so the block should lift without a second step.
      ...(payment.status === "paid" && sub.status === "past_due" ? { status: "active" as const } : {}),
    });
  },

  async markPaymentPaid(id: string, paymentId: string) {
    const sub = await col.byId(id);
    if (!sub) return null;
    const payments = (sub.payments || []).map(p =>
      p.id === paymentId ? { ...p, status: "paid" as const, paidAt: new Date().toISOString() } : p);
    return col.update(id, {
      payments,
      ...(sub.status === "past_due" ? { status: "active" as const } : {}),
    });
  },

  /** Monthly MRR movement buckets for the stacked chart — every bar
   *  traces to ledger entries, nothing is interpolated. */
  async mrrMovements(months = 6) {
    const subs = await col.all();
    const buckets: Record<string, Record<MrrMovementType, number>> = {};
    const keys: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7);
      keys.push(k);
      buckets[k] = { new_business: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0 };
    }
    for (const s of subs) {
      const startKey = s.startedAt.slice(0, 7);
      if (startKey in buckets) buckets[startKey].new_business += monthlyPaise(s);
      for (const m of s.movements || []) {
        const k = m.at.slice(0, 7);
        if (k in buckets) buckets[k][m.type] += Math.abs(m.deltaPaise);
      }
    }
    return keys.map(k => ({ month: k, ...buckets[k] }));
  },

  // ── Aggregate stats for the admin dashboard ──
  async stats() {
    const subs = await col.all();
    const active = subs.filter(s => s.status === "active" || s.status === "trialing");

    // MRR: normalize annual plans to a monthly figure
    const mrrPaise = active.reduce((sum, s) => sum + monthlyPaise(s), 0);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const cancelledLast30d = subs.filter(
      s => s.cancelledAt && now - new Date(s.cancelledAt).getTime() < 30 * DAY,
    ).length;
    const activeStart30dAgo = active.length + cancelledLast30d; // rough churn base
    const churnRate = activeStart30dAgo > 0 ? cancelledLast30d / activeStart30dAgo : 0;

    return {
      totalSubscriptions: subs.length,
      activeSubscriptions: active.length,
      mrrPaise,
      churnRate,
    };
  },

  // Revenue collected per day for the last N days — feeds the dashboard chart.
  async revenueByDay(days = 30): Promise<{ date: string; amountPaise: number }[]> {
    const subs = await col.all();
    const buckets: Record<string, number> = {};
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const s of subs) {
      const day = s.startedAt.slice(0, 10);
      if (day in buckets) buckets[day] += s.amountPaise;
    }
    return Object.entries(buckets).map(([date, amountPaise]) => ({ date, amountPaise }));
  },
};
