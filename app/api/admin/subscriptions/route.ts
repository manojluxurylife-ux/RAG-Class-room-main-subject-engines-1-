import { NextResponse } from "next/server";
import { subscriptionsStore, PLAN_PRICES, type PlanId } from "@/lib/subscriptions-store";
import { plansStore } from "@/lib/billing-plans-store";
import { studentsStore } from "@/lib/students-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// GET /api/admin/subscriptions — full payment/subscription list for the admin Subscriptions page
export async function GET() {
  return withApiErrorHandling("GET /api/admin/subscriptions", async () => {
    // Reconcile lazily so the admin sees TRUE statuses (past_due,
    // auto-cancelled) even for students who haven't opened the app.
    const subs = await subscriptionsStore.reconcileAll();
    const stats = await subscriptionsStore.stats();
    const revenueByDay = await subscriptionsStore.revenueByDay(30);
    const mrrMovements = await subscriptionsStore.mrrMovements(6);
    return NextResponse.json({ subscriptions: subs, stats, revenueByDay, mrrMovements });
  });
}

// POST /api/admin/subscriptions — manually record a subscription
// (until Razorpay webhooks are wired up, admin can log payments taken
// outside the app — cash, bank transfer, etc. — here)
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/admin/subscriptions", async () => {
    const { studentId, plan } = await req.json();
    if (!studentId || !plan) {
      return NextResponse.json({ error: "studentId and plan are required." }, { status: 400 });
    }
    const student = await studentsStore.byId(studentId);
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (plan === "family_annual" ? 12 : 1));

    const record = await subscriptionsStore.create({
      studentId, studentEmail: student.email, studentName: student.name,
      plan: plan as PlanId, amountPaise: PLAN_PRICES[plan as PlanId] || 0,
      status: "active",
      startedAt: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
    });
    return NextResponse.json({ subscription: record }, { status: 201 });
  });
}

/**
 * PATCH /api/admin/subscriptions
 * body: { id, action: "cancel_now" | "cancel_period_end" | "pause" |
 *         "resume" | "reactivate" | "extend_trial" | "change_plan",
 *         planId? }
 *
 * The lifecycle actions (Meteroid: "full lifecycle control: upgrades,
 * downgrades, mid-cycle changes, and cancellations"). Role-guarded by
 * middleware.ts — /api/admin/* requires a verified admin session.
 */
export async function PATCH(req: Request) {
  return withApiErrorHandling("PATCH /api/admin/subscriptions", async () => {
    const { id, action, planId } = await req.json();
    if (!id || !action) {
      return NextResponse.json({ error: "id and action are required." }, { status: 400 });
    }

    let updated;
    switch (action) {
      case "cancel_now":        updated = await subscriptionsStore.cancel(id, "now"); break;
      case "cancel_period_end": updated = await subscriptionsStore.cancel(id, "period_end"); break;
      case "pause":             updated = await subscriptionsStore.pause(id); break;
      case "resume":            updated = await subscriptionsStore.resume(id); break;
      case "reactivate":        updated = await subscriptionsStore.reactivate(id); break;
      case "extend_trial":      updated = await subscriptionsStore.extendTrial(id, 7); break;
      case "change_plan": {
        if (!planId) return NextResponse.json({ error: "planId is required for change_plan." }, { status: 400 });
        const plan = await plansStore.byId(planId);
        if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
        updated = await subscriptionsStore.changePlan(id, plan.name, plan.amountPaise, plan.interval);
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }

    if (!updated) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    return NextResponse.json({ subscription: updated });
  });
}
