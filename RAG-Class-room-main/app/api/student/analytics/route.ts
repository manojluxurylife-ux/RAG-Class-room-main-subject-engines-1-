import { NextResponse } from "next/server";
import { buildChildAnalytics } from "@/lib/child-analytics";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

// Always hit Firestore live — never statically prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * GET /api/student/analytics?studentId=xxx
 *
 * The same 8 evaluation analytics the parent portal shows, for the
 * student's OWN account — powers the Parent's Corner page inside the
 * student app, where a parent picks up the child's phone and sees the
 * evaluation without needing a separate parent-portal login.
 *
 * Auth model: identified by studentId like every other /api/student/*
 * endpoint (study-materials, materials) — the data returned is the
 * same student's own learning record that the app already shows them.
 */
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/analytics", async () => {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }
    await requireStudentMatching(studentId);
    const analytics = await buildChildAnalytics(studentId);
    if (!analytics) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    return NextResponse.json(analytics);
  });
}
