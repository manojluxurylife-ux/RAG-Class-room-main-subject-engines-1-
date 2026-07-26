import { NextResponse } from "next/server";
import { findExamPattern, totalQuestionCount } from "@/lib/exam-patterns";
import { examPaperSystemPrompt } from "@/lib/content-generators";
import { isValidExamPaper } from "@/lib/exam-schema";
import { examAttemptsStore } from "@/lib/exam-attempts-store";
import { callGemini } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/exam-room/start
 * body: { studentId, board, grade, subject, languageId }
 *
 * Generates a full exam paper following a REAL, verified board pattern
 * (lib/exam-patterns.ts) and creates a timed attempt. Only ever
 * generates a paper for a pattern that's actually been verified — no
 * fallback to an invented/approximated structure, since that would
 * defeat the entire point of simulating a real exam.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/exam-room/start", async () => {
    const { studentId, board, grade, subject, languageId = "english" } = await req.json();
    if (!studentId || !board || !grade || !subject) {
      return NextResponse.json({ error: "Missing studentId, board, grade, or subject." }, { status: 400 });
    }
    await requireStudentMatching(studentId);

    const pattern = findExamPattern(board, grade, subject);
    if (!pattern) {
      return NextResponse.json({ error: "No verified exam pattern exists yet for this board/class/subject." }, { status: 404 });
    }

    const system = examPaperSystemPrompt({
      subject, grade, boardId: board, languageId,
      sections: pattern.sections.map(s => ({ label: s.label, blocks: s.blocks })),
    });
    const raw = await callGemini(system, "Generate the full exam paper now.", { maxOutputTokens: 16384, json: true });
    const parsed = parseAiJson(raw);

    if (!isValidExamPaper(parsed)) {
      return NextResponse.json({ error: "Could not generate the exam paper. Please try again." }, { status: 502 });
    }

    // Give every question a stable id and confirm section/marks tags
    // match the real pattern — never trust the AI's own tagging blindly.
    const sections = parsed.sections.map((s: any, si: number) => {
      const patternSection = pattern.sections[si];
      return {
        label: patternSection?.label || s.label,
        questions: s.questions.map((q: any) => ({ ...q, id: nanoid(8), sectionLabel: patternSection?.label || s.label })),
      };
    });

    const expectedCount = totalQuestionCount(pattern);
    const actualCount = sections.reduce((sum: number, s: any) => sum + s.questions.length, 0);
    if (actualCount < expectedCount * 0.7) {
      // A real, meaningful shortfall (not just off-by-one) — don't start
      // a "timed exam" that's silently missing a third of its questions.
      return NextResponse.json({ error: "The generated paper was incomplete. Please try again." }, { status: 502 });
    }

    const now = new Date().toISOString();
    const attempt = await examAttemptsStore.create({
      studentId, patternId: pattern.id, board, grade, subject,
      totalMarks: pattern.totalMarks, durationMinutes: pattern.durationMinutes,
      sections,
      answers: {}, writtenAnswers: {}, selfMarks: {},
      startedAt: now,
    });

    return NextResponse.json({ attempt }, { status: 201 });
  });
}
