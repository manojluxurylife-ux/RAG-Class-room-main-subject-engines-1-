import { NextResponse } from "next/server";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import type { ExamQuestion, SelfMark } from "@/lib/exam-schema";
import { AUTO_CHECKABLE } from "@/lib/practice-schema";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching, sessionOwns } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/exam-room/[id]/submit
 * body: { answers, writtenAnswers, selfMarks }
 *
 * Computes the auto-score server-side — never trusts a client-reported
 * score, the same principle as every other graded feature in this app.
 * Same per-format correctness logic already verified in Practice
 * Materials (lib/practice-schema.ts's AUTO_CHECKABLE), applied here to
 * a real, marks-weighted paper instead of a flat right/wrong count.
 *
 * Only AUTO_CHECKABLE formats contribute to autoScore/autoScoreMax.
 * Self-assessed marks (short-answer/long-answer/case-study) are stored
 * as reported by the student and surfaced separately as
 * estimatedScore — never silently folded into the objective score.
 */
function isCorrect(q: ExamQuestion, answer: any): boolean {
  switch (q.format) {
    case "mcq": case "hots": case "competency-based": case "assertion-reason":
      return answer === q.correctIndex;
    case "true-false":
      return typeof answer === "boolean" && answer === q.answerBool;
    case "fill-blank":
      return typeof answer === "string" && answer.trim().toLowerCase() === (q.blankAnswer || "").trim().toLowerCase();
    case "match-following": {
      if (!answer || typeof answer !== "object" || !q.correctMapping) return false;
      return q.correctMapping.every((correctIdx, i) => answer[i] === correctIdx);
    }
    default:
      return false;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrorHandling("POST /api/student/exam-room/[id]/submit", async () => {
    const session = await requireStudentMatching();
    const attempt = await examAttemptsStore.byId(params.id);
    // Same 404 for "doesn't exist" and "not yours" — no attempt-id probing.
    if (!attempt || !sessionOwns(session, attempt.studentId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (attempt.submittedAt) return NextResponse.json({ error: "This attempt was already submitted." }, { status: 409 });

    const { answers = {}, writtenAnswers = {}, selfMarks = {} } = await req.json();

    let autoScore = 0, autoScoreMax = 0, selfAssessedScore = 0;
    for (const section of attempt.sections) {
      for (const q of section.questions) {
        if (AUTO_CHECKABLE.includes(q.format)) {
          autoScoreMax += q.marks;
          if (isCorrect(q, answers[q.id])) autoScore += q.marks;
        } else {
          const mark = (selfMarks as Record<string, SelfMark>)[q.id];
          if (mark === "correct") selfAssessedScore += q.marks;
          else if (mark === "partial") selfAssessedScore += q.marks / 2;
        }
      }
    }

    const updated = await examAttemptsStore.submit(params.id, {
      answers, writtenAnswers, selfMarks,
      submittedAt: new Date().toISOString(),
      autoScore, autoScoreMax,
      estimatedScore: Math.round((autoScore + selfAssessedScore) * 10) / 10,
    });

    return NextResponse.json({ attempt: updated });
  });
}
