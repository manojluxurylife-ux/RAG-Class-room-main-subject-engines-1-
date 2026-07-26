import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callGemini, lessonSystemPrompt } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";

export async function POST(req: Request) {
  const { topic, grade, boardId, languageId } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "Missing 'topic'." }, { status: 400 });
  }

  try {
    const system = lessonSystemPrompt({ grade, boardId, languageId });
    const raw = await callGemini(system, `Teach this topic: ${topic}`);
    const lesson = parseAiJson(raw);
    return NextResponse.json({ lesson });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not generate the lesson. Please try again." }, { status: 502 });
  }
}
