import { NextResponse } from "next/server";
import { subscriptionsStore } from "@/lib/subscriptions-store";
import { messagesStore } from "@/lib/messages-store";
import { computeAccess } from "@/lib/subscription-policy";
import { ENFORCE_SUBSCRIPTIONS } from "@/lib/dev-mode";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * GET /api/student/subscription?studentId=email
 *
 * The student-side gate check, and where the dunning flow actually
 * fires — lazily, on app use, no cron:
 *   1. reconcile: apply overdue transitions (→ past_due, → cancelled)
 *   2. notify:    on the FIRST read after a lapse, drop one polite
 *                 renew notice into the Messages inbox (worded for the
 *                 parent, never guilt for the child) — once per lapse,
 *                 guarded by dunningNotifiedAt
 *   3. compute:   grace / degraded per lib/subscription-policy.ts
 *
 * While ENFORCE_SUBSCRIPTIONS is false (dev stage), the response always
 * reports level "full" but carries the real computed level in
 * `wouldBe`, so the machinery is observable before it has teeth.
 */
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/subscription", async () => {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }
    // studentId here is historically the student's EMAIL — the matcher
    // accepts either the session's id or email.
    await requireStudentMatching(studentId);

    let sub = await subscriptionsStore.byEmail(studentId);
    if (sub) {
      const before = sub.status;
      sub = await subscriptionsStore.reconcile(sub);

      // First read after lapsing → one reminder, addressed to the parent.
      if (sub.status === "past_due" && !sub.dunningNotifiedAt) {
        try {
          await messagesStore.systemNotice({
            studentId: sub.studentEmail,
            studentName: sub.studentName,
            studentEmail: sub.studentEmail,
            subject: "Your AI Guru plan has ended — renew to keep premium features",
            text:
              `Dear parent, ${sub.studentName}'s AI Guru plan (${sub.plan}) ended on ` +
              `${new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. ` +
              `Everything keeps working for 7 days of grace. To continue Study Materials, Exam Room, ` +
              `Practice and the Library after that, please renew — Monthly ₹599 or Yearly ₹5,000. ` +
              `Reply here and our team will help you complete the payment. ` +
              `${sub.studentName}'s progress, materials and textbooks are safe either way.`,
          });
          await subscriptionsStore.markDunningNotified(sub.id);
        } catch (e: any) {
          // A failed notice must never block the student's app load.
          console.error("[subscription notice]", e.message, "prev status:", before);
        }
      }
    }

    const access = computeAccess(sub);
    if (!ENFORCE_SUBSCRIPTIONS) {
      return NextResponse.json({ ...access, level: "full", wouldBe: access.level, enforced: false });
    }
    return NextResponse.json({ ...access, enforced: true });
  });
}
