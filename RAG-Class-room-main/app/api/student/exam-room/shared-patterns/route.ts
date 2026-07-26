import { NextResponse } from "next/server";
import { sharedExamPatternsStore } from "@/lib/shared-exam-patterns";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/student/exam-room/shared-patterns?board=X&grade=Y&subject=Z (optional)
// Without "subject": every pattern already available for this exact
// board+grade, across all subjects — what actually makes a
// previously-uploaded paper "available to" a matching student, rather
// than only discoverable if they happen to type the right subject name.
// With "subject": the original exact-match lookup, still used by the
// upload flow to check before publishing a near-duplicate.
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/exam-room/shared-patterns", async () => {
    await requireStudentMatching();
    const url = new URL(req.url);
    const board = url.searchParams.get("board");
    const grade = url.searchParams.get("grade");
    const subject = url.searchParams.get("subject");
    if (!board || !grade) {
      return NextResponse.json({ error: "board and grade are required." }, { status: 400 });
    }
    const patterns = subject
      ? await sharedExamPatternsStore.findMatching(board, grade, subject)
      : await sharedExamPatternsStore.findAllForClass(board, grade);
    return NextResponse.json({ patterns });
  });
}
