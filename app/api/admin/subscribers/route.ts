import { NextResponse } from "next/server";
import { subscriptionsStore } from "@/lib/subscriptions-store";
import { studentsStore } from "@/lib/students-store";
import { withApiErrorHandling } from "@/lib/api-error";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

// Role-guarded by middleware.ts (/api/admin/* → verified admin session).

/**
 * GET /api/admin/subscribers
 *
 * Every subscriber = subscription record JOINED with the student's
 * signup profile (phone, country, state, district, place, school,
 * class) — the geography/school fields the signup form already collects
 * — plus the payment history ledger and a derived paid/pending flag.
 * The page filters client-side, so one fetch serves all segregations.
 *
 * paymentState: "pending" if ANY ledger entry is pending (money is
 * owed), "paid" if all entries are paid, "none" if nothing recorded yet
 * — three honest states rather than pretending an empty ledger is paid.
 */
export async function GET() {
  return withApiErrorHandling("GET /api/admin/subscribers", async () => {
    const [subs, students] = await Promise.all([
      subscriptionsStore.all(),
      studentsStore.all(),
    ]);
    const byId    = new Map(students.map(s => [s.id, s]));
    const byEmail = new Map(students.map(s => [s.email.toLowerCase(), s]));

    const subscribers = subs.map(sub => {
      const student = byId.get(sub.studentId) || byEmail.get(sub.studentEmail.toLowerCase());
      const payments = sub.payments || [];
      const paymentState =
        payments.some(p => p.status === "pending") ? "pending"
        : payments.length > 0 ? "paid"
        : "none";
      return {
        id: sub.id,
        name: sub.studentName,
        email: sub.studentEmail,
        phone:     student?.phone      || "",
        country:   student?.country    || "",
        state:     student?.state      || "",
        district:  student?.district   || "",
        place:     student?.place      || "",
        school:    student?.schoolName || "",
        className: student?.className  || "",
        plan: sub.plan,
        amountPaise: sub.amountPaise,
        status: sub.status,
        startedAt: sub.startedAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        payments,
        paymentState,
      };
    });

    // Distinct values for the filter dropdowns — only what actually exists.
    const distinct = (key: "country" | "state" | "place" | "school" | "className") =>
      Array.from(new Set(subscribers.map(s => s[key]).filter(Boolean))).sort();

    return NextResponse.json({
      subscribers,
      filters: {
        countries: distinct("country"),
        states:    distinct("state"),
        places:    distinct("place"),
        schools:   distinct("school"),
        classes:   distinct("className"),
      },
    });
  });
}

/**
 * PATCH /api/admin/subscribers
 * body: { id, action: "add_payment", amountPaise, status: "paid"|"pending", note? }
 *     | { id, action: "mark_paid", index }
 */
export async function PATCH(req: Request) {
  return withApiErrorHandling("PATCH /api/admin/subscribers", async () => {
    const body = await req.json();
    const { id, action } = body;
    if (!id || !action) {
      return NextResponse.json({ error: "id and action are required." }, { status: 400 });
    }

    let updated;
    if (action === "add_payment") {
      const { amountPaise, status, note } = body;
      if (!amountPaise || !["paid", "pending"].includes(status)) {
        return NextResponse.json({ error: "amountPaise and status (paid|pending) are required." }, { status: 400 });
      }
      updated = await subscriptionsStore.recordPayment(id, { amountPaise: Math.round(amountPaise), status, note, method: body.method });
    } else if (action === "mark_paid") {
      if (!body.paymentId) {
        return NextResponse.json({ error: "paymentId is required." }, { status: 400 });
      }
      updated = await subscriptionsStore.markPaymentPaid(id, body.paymentId);
    } else {
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }

    if (!updated) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    return NextResponse.json({ subscription: updated });
  });
}
