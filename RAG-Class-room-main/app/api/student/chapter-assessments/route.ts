import { NextResponse } from "next/server";
import { chapterAssessmentsStore } from "@/lib/chapter-assessments";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { studentsStore } from "@/lib/students-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/chapter-assessments", async () => {
    const studentId = new URL(req.url).searchParams.get("studentId");
    await requireStudentMatching(studentId);
    if (!studentId) return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    return NextResponse.json({ attempts: await chapterAssessmentsStore.byStudent(studentId) });
  });
}

export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/chapter-assessments", async () => {
    const body = await req.json();
    if (!body.studentId || !body.documentId || !body.chapterTitle || !Array.isArray(body.answers)) {
      return NextResponse.json({ error: "Student, textbook, chapter and answers are required." }, { status: 400 });
    }
    const total = body.answers.length;
    const score = body.answers.filter((a: any) => a.correct).length;
    const percentage = total ? Math.round((score / total) * 100) : 0;
    const suppliedStudentId = String(body.studentId);
    await requireStudentMatching(suppliedStudentId);
    const student = await studentsStore.byId(suppliedStudentId) || await studentsStore.byEmail(suppliedStudentId);
    const attempt = await chapterAssessmentsStore.record({
      studentId: suppliedStudentId, canonicalStudentId: student?.id,
      documentId: String(body.documentId),
      textbookTitle: String(body.textbookTitle || "Textbook"), subject: String(body.subject || "General"),
      chapterId: String(body.chapterId || body.chapterTitle), chapterTitle: String(body.chapterTitle),
      score, total, percentage, passed: percentage >= 60, answers: body.answers,
    });
    return NextResponse.json({ attempt });
  });
}
