import { NextResponse } from "next/server";
import { callGemini } from "@/lib/teacher-prompts";
import { virtualLabNarrationPrompt } from "@/lib/content-generators";
import { findLabExperiment, formatLabForPrompt } from "@/lib/lab-kb";
import { parseAiJson } from "@/lib/safe-json";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireStudentMatching } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/virtual-lab
 * body: { experimentQuery, subject, grade, boardId, languageId }
 *
 * Grounded narration, not a simulation — see lib/lab-kb.ts for the full
 * reasoning. Checks the curated seed set first; if a real match is
 * found, the AI narrates those actual facts. If not, it answers from
 * general knowledge, and the response is explicitly flagged as
 * ungrounded so the UI can show a different confidence level — never
 * silently presented the same way as a verified match.
 */
export async function POST(req: Request) {
  return withApiErrorHandling("POST /api/student/virtual-lab", async () => {
    await requireStudentMatching();
    const { experimentQuery, subject, grade = "10", boardId = "cbse", languageId = "english" } = await req.json();
    if (!experimentQuery?.trim()) {
      return NextResponse.json({ error: "Missing 'experimentQuery'." }, { status: 400 });
    }

    const match = findLabExperiment(experimentQuery, subject, grade);
    const groundedContext = match ? formatLabForPrompt(match) : null;

    const system = virtualLabNarrationPrompt({
      subject: subject || "Science", grade, boardId, languageId,
      experimentQuery, groundedContext,
    });
    const raw = await callGemini(system, "Narrate this experiment now.");
    const parsed = parseAiJson(raw);

    if (!parsed?.experimentName || !Array.isArray(parsed?.procedure)) {
      return NextResponse.json({ error: "Could not generate this narration. Try rephrasing the experiment name." }, { status: 502 });
    }

    return NextResponse.json({ narration: parsed, grounded: !!match });
  });
}
