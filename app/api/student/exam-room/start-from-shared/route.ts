import { NextResponse } from "next/server";
import { examPaperSystemPrompt } from "@/lib/content-generators";
import { isValidExamPaper } from "@/lib/exam-schema";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import { sharedExamPatternsStore } from "@/lib/shared-exam-patterns";
import { callGemini } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/exam-room/start-from-shared
 * body: { studentId, languageId, sharedPatternId }
 *
 * A different student using a pattern someone else already contributed
 * — generates a genuinely FRESH set of questions from the shared
 * structure (never reuses another student's actual generated
 * questions), in the requesting student's own language, then records
 * the use so useCount reflects real, ongoing trust in this pattern.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/exam-room/start-from-shared", async () => {
    const { studentId, languageId = "english", sharedPatternId } = await req.json();
    if (!studentId || !sharedPatternId) {
      return NextResponse.json({ error: "Missing studentId or sharedPatternId." }, { status: 400 });
    }
    await requireStudentMatching(studentId);

    const shared = await sharedExamPatternsStore.byId(sharedPatternId);
    if (!shared) return NextResponse.json({ error: "This shared pattern is no longer available." }, { status: 404 });

    const system = examPaperSystemPrompt({
      subject: shared.subject, grade: shared.grade, boardId: shared.board, languageId,
      sections: shared.sections.map(s => ({ label: s.label, blocks: s.blocks })),
    });
    const raw = await callGemini(system, "Generate the full exam paper now.", { maxOutputTokens: 16384, json: true });
    const parsed = parseAiJson(raw);

    if (!isValidExamPaper(parsed)) {
      return NextResponse.json({ error: "Could not generate the exam paper. Please try again." }, { status: 502 });
    }

    const sections = parsed.sections.map((s: any, si: number) => {
      const patternSection = shared.sections[si];
      return {
        label: patternSection?.label || s.label,
        questions: s.questions.map((q: any) => ({ ...q, id: nanoid(8), sectionLabel: patternSection?.label || s.label })),
      };
    });

    const now = new Date().toISOString();
    const attempt = await examAttemptsStore.create({
      studentId, patternId: shared.id, board: shared.board, grade: shared.grade, subject: shared.subject,
      totalMarks: shared.totalMarks, durationMinutes: shared.durationMinutes,
      sections,
      answers: {}, writtenAnswers: {}, selfMarks: {},
      startedAt: now,
    });

    await sharedExamPatternsStore.incrementUseCount(sharedPatternId);

    return NextResponse.json({ attempt }, { status: 201 });
  });
}
