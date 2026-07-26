import { NextResponse } from "next/server";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import { AUTO_CHECKABLE } from "@/lib/practice-schema";
import type { SelfMark } from "@/lib/exam-schema";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching, sessionOwns } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/exam-room/[id]/self-mark
 * body: { questionId, mark: "correct" | "partial" | "incorrect" }
 *
 * Self-assessment happens progressively, one open-ended question at a
 * time, only after the exam is submitted (a student shouldn't see model
 * answers while still able to change their other answers). Callable
 * repeatedly — recomputes estimatedScore fresh from all selfMarks each
 * time, so changing your mind about an earlier question is safe, not
 * additive/order-dependent.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/exam-room/[id]/self-mark", async () => {
    const session = await requireStudentMatching();
    const attempt = await examAttemptsStore.byId(params.id);
    // Same 404 for "doesn't exist" and "not yours" — no attempt-id probing.
    if (!attempt || !sessionOwns(session, attempt.studentId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (!attempt.submittedAt) return NextResponse.json({ error: "Submit the exam before self-assessing." }, { status: 409 });

    const { questionId, mark } = await req.json() as { questionId: string; mark: SelfMark };
    if (!questionId || !["correct", "partial", "incorrect"].includes(mark)) {
      return NextResponse.json({ error: "Invalid questionId or mark." }, { status: 400 });
    }

    const selfMarks = { ...attempt.selfMarks, [questionId]: mark };

    let selfAssessedScore = 0;
    for (const section of attempt.sections) {
      for (const q of section.questions) {
        if (!AUTO_CHECKABLE.includes(q.format)) {
          const m = selfMarks[q.id];
          if (m === "correct") selfAssessedScore += q.marks;
          else if (m === "partial") selfAssessedScore += q.marks / 2;
        }
      }
    }

    const updated = await examAttemptsStore.submit(params.id, {
      selfMarks,
      estimatedScore: Math.round(((attempt.autoScore || 0) + selfAssessedScore) * 10) / 10,
    });

    return NextResponse.json({ attempt: updated });
  });
}
