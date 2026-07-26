import { NextResponse } from "next/server";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/student/exam-room/history?studentId=xxx — the student's own past attempts
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/exam-room/history", async () => {
    const studentId = new URL(req.url).searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    await requireStudentMatching(studentId);
    const attempts = await examAttemptsStore.byStudent(studentId);
    return NextResponse.json({ attempts });
  });
}
