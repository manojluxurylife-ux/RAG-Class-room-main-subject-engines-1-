import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callGemini, qaSystemPrompt } from "@/lib/teacher-prompts";

export async function POST(req: Request) {
  // Signed-in users only — this endpoint spends the app's server-side
  // Gemini key (GEMINI_API_KEY); leaving it open lets anyone on the
  // internet drain the quota anonymously.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in to use this feature." }, { status: 401 });
  }

  const { question, topic, grade, boardId, languageId } = await req.json();
  if (!question) {
    return NextResponse.json({ error: "Missing 'question'." }, { status: 400 });
  }

  try {
    const system = qaSystemPrompt({ topic, grade, boardId, languageId });
    const answer = await callGemini(system, question);
    return NextResponse.json({ answer: answer.trim() });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { answer: "Sorry, I couldn't hear that clearly — could you ask again?" },
      { status: 502 }
    );
  }
}
