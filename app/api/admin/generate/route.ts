import { NextResponse } from "next/server";
import { callGemini } from "@/lib/teacher-prompts";
import { buildSystemPrompt, defaultTitle, type MaterialKind } from "@/lib/content-generators";

/**
 * POST /api/admin/generate
 * body: { kind, topic, subject, grade, boardId, languageId,
 *         quizFormat?, quizDifficulty?, examStyle?,
 *         notesSubtype?, lessonStyle?, mindmapType?, includeMnemonics? }
 * Returns: { title, content }  — content is markdown text
 *
 * The extra params are all optional — omitting them gives exactly the
 * previous default behaviour, so this stays backward compatible with any
 * existing caller.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    kind, topic, subject = "Maths", grade = "8", boardId = "cbse", languageId = "english",
    quizFormat, quizDifficulty, examStyle, notesSubtype, lessonStyle, mindmapType, includeMnemonics,
  } = body;

  const VALID_KINDS: MaterialKind[] = [
    "lesson-plan","slides","quiz","flashcards","mind-map","lab-manual","voice-script","revision-notes",
  ];
  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid or missing 'kind'." }, { status: 400 });
  }
  if (!topic?.trim()) {
    return NextResponse.json({ error: "Missing 'topic'." }, { status: 400 });
  }

  try {
    const params = {
      topic, subject, grade, boardId, languageId,
      quizFormat, quizDifficulty, examStyle, notesSubtype, lessonStyle, mindmapType, includeMnemonics,
    };
    const system  = buildSystemPrompt(kind, params);
    const content = await callGemini(system, `Generate the ${kind.replace("-", " ")} now.`);
    return NextResponse.json({ title: defaultTitle(kind, topic, params), content: content.trim() });
  } catch (err: any) {
    console.error("[/api/admin/generate]", err.message);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 502 });
  }
}
