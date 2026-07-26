import { NextResponse } from "next/server";
import { examPaperSystemPrompt } from "@/lib/content-generators";
import { isValidExamPaper } from "@/lib/exam-schema";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import { findSectionMarksMismatches } from "@/lib/exam-patterns";
import { sharedExamPatternsStore } from "@/lib/shared-exam-patterns";
import { callGemini } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/exam-room/start-from-pdf
 * body: { studentId, grade, subject, languageId, board?, draft: ExtractedPatternDraft }
 *
 * Stage 2 of the "upload your own paper" flow — takes the structure the
 * student already confirmed (from /extract-pdf) and generates the full
 * paper against it, exactly like the pre-built-pattern flow
 * (/api/student/exam-room/start) does, just fed a student-supplied
 * structure instead of a curated one from lib/exam-patterns.ts.
 *
 * Also auto-publishes the STRUCTURE (never the generated questions —
 * see lib/shared-exam-patterns.ts for why that distinction matters) to
 * the shared pool for other students in the exact same board/grade/
 * subject category, so the next "Class 8 Tamil Medium Geography"
 * student doesn't need to upload their own copy. The mismatch check is
 * recomputed here server-side rather than trusting whatever the client
 * reported earlier — this decision affects other students, not just the
 * one making this request, so it doesn't rely on client-supplied data.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/exam-room/start-from-pdf", async () => {
    const { studentId, grade, subject, languageId = "english", board = "custom", draft } = await req.json();
    if (!studentId || !grade || !subject || !draft?.sections?.length) {
      return NextResponse.json({ error: "Missing studentId, grade, subject, or the extracted structure." }, { status: 400 });
    }
    await requireStudentMatching(studentId);

    const system = examPaperSystemPrompt({
      subject, grade, boardId: board, languageId,
      sections: draft.sections.map((s: any) => ({ label: s.label, blocks: s.blocks })),
    });
    const raw = await callGemini(system, "Generate the full exam paper now.", { maxOutputTokens: 16384, json: true });
    const parsed = parseAiJson(raw);

    if (!isValidExamPaper(parsed)) {
      return NextResponse.json({ error: "Could not generate the exam paper from this structure. Please try again." }, { status: 502 });
    }

    const sections = parsed.sections.map((s: any, si: number) => {
      const draftSection = draft.sections[si];
      return {
        label: draftSection?.label || s.label,
        questions: s.questions.map((q: any) => ({ ...q, id: nanoid(8), sectionLabel: draftSection?.label || s.label })),
      };
    });

    const now = new Date().toISOString();
    const attempt = await examAttemptsStore.create({
      studentId, patternId: "custom-upload", board, grade, subject,
      totalMarks: draft.totalMarks, durationMinutes: draft.durationMinutes || 60,
      sections,
      answers: {}, writtenAnswers: {}, selfMarks: {},
      startedAt: now,
    });

    // Auto-publish the structure for other students in the exact same
    // category — real, server-recomputed check, not client-trusted.
    // A board other than "custom" is required too: an anonymous/no-board
    // upload has no real category for another student to match against.
    if (board !== "custom") {
      const mismatches = findSectionMarksMismatches(draft);
      if (mismatches.length === 0) {
        try {
          await sharedExamPatternsStore.create({
            board, grade, subject,
            totalMarks: draft.totalMarks, durationMinutes: draft.durationMinutes || 60,
            sections: draft.sections, contributedBy: studentId,
          });
        } catch (e: any) {
          console.error("[start-from-pdf] shared pattern publish failed", e.message);
          // Not fatal — the student's own exam already started fine either way.
        }
      }
    }

    return NextResponse.json({ attempt }, { status: 201 });
  });
}
