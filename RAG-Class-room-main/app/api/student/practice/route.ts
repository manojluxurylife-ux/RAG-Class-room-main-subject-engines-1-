import { NextResponse } from "next/server";
import { callGemini } from "@/lib/teacher-prompts";
import { practiceQuestionsSystemPrompt } from "@/lib/content-generators";
import { isValidPracticeSet } from "@/lib/practice-schema";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/practice
 * body: { topic, subject, grade, boardId, languageId,
 *         quizFormat, quizDifficulty, examStyle, count }
 *
 * Generates a structured, interactive practice set — genuinely
 * checkable question-by-question in the browser, not markdown text with
 * an answer key at the end. Ephemeral/session-only, same pattern as
 * Classroom's "Ask AI Guru" Q&A — a practice session is a one-off,
 * not something that needs to persist across visits.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/practice", async () => {
    await requireStudentMatching();
    const body = await req.json();
    const {
      topic, subject = "Mathematics", grade = "8", boardId = "cbse", languageId = "english",
      quizFormat = "mcq", quizDifficulty = "medium", examStyle = "standard", count = 5,
    } = body;

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Missing 'topic'." }, { status: 400 });
    }

    const system = practiceQuestionsSystemPrompt({
      topic, subject, grade, boardId, languageId, quizFormat, quizDifficulty, examStyle, count,
    });
    const raw = await callGemini(system, "Generate the practice questions now.");
    const parsed = parseAiJson(raw);

    if (!isValidPracticeSet(parsed)) {
      return NextResponse.json({ error: "Could not generate practice questions. Please try again." }, { status: 502 });
    }

    // Give every question a stable id (the AI doesn't produce these).
    parsed.questions = parsed.questions.map((q: any, i: number) => ({ ...q, id: `q${i}` }));

    return NextResponse.json({ practiceSet: parsed });
  });
}
