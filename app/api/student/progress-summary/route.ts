import { NextResponse } from "next/server";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { chapterAssessmentsStore } from "@/lib/chapter-assessments";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/progress-summary?studentId=xxx
 *
 * Single aggregated call powering the /progress page — computed from
 * every one of the student's study materials (Firestore), not just one
 * material at a time. Three views, all derived from the same underlying
 * completionLog/quizAttempts data added to the schema for this purpose:
 *
 *  - subjectBreakdown: chapters (segments) completed per subject
 *  - attendanceByDate: which subjects had real activity on which days,
 *    last 30 days — "date-wise attendance"
 *  - quiz results: every attempt, right or wrong, most recent first,
 *    plus an overall accuracy percentage
 */
export async function GET(req: Request) {
  return withApiErrorHandling("GET /api/student/progress-summary", async () => {
    const studentId = new URL(req.url).searchParams.get("studentId");
    await requireStudentMatching(studentId);
    if (!studentId) return NextResponse.json({ error: "studentId is required." }, { status: 400 });

    const materials = await studyMaterialsStore.byStudent(studentId);
    const chapterTests = await chapterAssessmentsStore.byStudent(studentId);

    // ── Subject breakdown ──
    const subjectMap: Record<string, { totalSegments: number; completedSegments: number; materials: number }> = {};
    for (const m of materials) {
      const entry = subjectMap[m.subject] || { totalSegments: 0, completedSegments: 0, materials: 0 };
      entry.totalSegments += m.segments.length;
      entry.completedSegments += m.progress.completedSegmentIds.length;
      entry.materials += 1;
      subjectMap[m.subject] = entry;
    }
    const subjectBreakdown = Object.entries(subjectMap).map(([subject, v]) => ({
      subject,
      ...v,
      pct: v.totalSegments > 0 ? Math.round((v.completedSegments / v.totalSegments) * 100) : 0,
    }));

    // ── Date-wise attendance (last 30 days) ──
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date();
    const dateKeys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY);
      dateKeys.push(d.toISOString().slice(0, 10));
    }
    const attendanceMap: Record<string, Set<string>> = {};
    for (const key of dateKeys) attendanceMap[key] = new Set();

    for (const m of materials) {
      for (const entry of m.progress.completionLog || []) {
        const day = entry.completedAt.slice(0, 10);
        if (attendanceMap[day]) attendanceMap[day].add(m.subject);
      }
      for (const attempt of m.progress.quizAttempts || []) {
        const day = attempt.attemptedAt.slice(0, 10);
        if (attendanceMap[day]) attendanceMap[day].add(m.subject);
      }
    }
    const attendanceByDate = dateKeys.map(date => ({
      date, subjects: Array.from(attendanceMap[date]),
    }));

    // ── Quiz / test results ──
    type FlatAttempt = { subject: string; materialTitle: string; segmentHeading: string; question: string; correct: boolean; attemptedAt: string };
    const allAttempts: FlatAttempt[] = [];
    for (const m of materials) {
      for (const attempt of m.progress.quizAttempts || []) {
        allAttempts.push({
          subject: m.subject, materialTitle: m.title,
          segmentHeading: attempt.segmentHeading, question: attempt.question,
          correct: attempt.correct, attemptedAt: attempt.attemptedAt,
        });
      }
    }
    allAttempts.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());
    const totalAttempts   = allAttempts.length;
    const correctAttempts = allAttempts.filter(a => a.correct).length;
    const accuracyPct     = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null;

    // ── Streak (consecutive days with any activity) ──
    let streak = 0;
    for (let i = dateKeys.length - 1; i >= 0; i--) {
      if (attendanceMap[dateKeys[i]].size > 0) streak++;
      else if (i < dateKeys.length - 1) break; // gap found, stop counting (today with no activity yet doesn't break it)
    }

    return NextResponse.json({
      subjectBreakdown,
      attendanceByDate,
      quizResults: allAttempts.slice(0, 20),
      quizStats: { totalAttempts, correctAttempts, accuracyPct },
      studyMaterialStreak: streak,
      totalMaterials: materials.length,
      chapterTests,
    });
  });
}
