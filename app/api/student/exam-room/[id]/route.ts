import { NextResponse } from "next/server";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching, sessionOwns } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/student/exam-room/[id] — a single exam attempt (in progress or submitted)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("GET /api/student/exam-room/[id]", async () => {
    const session = await requireStudentMatching();
    const attempt = await examAttemptsStore.byId(params.id);
    // Same 404 for "doesn't exist" and "not yours" — no attempt-id probing.
    if (!attempt || !sessionOwns(session, attempt.studentId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ attempt });
  });
}
