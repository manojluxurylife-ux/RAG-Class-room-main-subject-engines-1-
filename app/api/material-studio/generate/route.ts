import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { search } from "@/lib/rag/store";
import { callGemini, languageInstruction } from "@/lib/teacher-prompts";
import { parseAiJson } from "@/lib/safe-json";
import { normalizeMaterialVisuals, VISUAL_JSON_INSTRUCTION } from "@/lib/visual-generation";
import { normalizeWhiteboardPlan, WHITEBOARD_COMMAND_JSON_INSTRUCTION } from "@/lib/whiteboard-commands";
export const runtime = "nodejs";

const specs: Record<string,string> = {
  classroom: "OpenMAIC-style 5-scene classroom lesson with teacher narration, blackboard points, student discussion prompts and a final check",
  ppt: "OpenMAIC-style 8-slide presentation outline; each slide needs title, 3-5 bullets, speaker notes and one real validated visual object",
  web_lesson: "OpenMAIC-style interactive web lesson with sections, reveal activities, checkpoints and a conclusion",
  simulation: "OpenMAIC-style safe educational simulation specification with objective, variables, controls, steps, observations and explanation",
  whiteboard: "OpenMAIC-style timed whiteboard lesson with drawing/writing actions and narration",
  discussion: "OpenMAIC-style classroom discussion with teacher plus three student viewpoints, misconceptions and teacher correction",
  interactive_book: "DeepTutor-style chapter with learning goals, explanations, worked examples, reflection questions and summary",
  flashcards: "DeepTutor-style flashcard deck with question, concise answer, hint and source citation",
  revision_notes: "DeepTutor-style exam revision notes with key ideas, definitions, formulas/facts, common errors and rapid recap",
  knowledge_base: "DeepTutor-style structured knowledge base with concepts, definitions, relationships, prerequisites and source citations",
  research: "DeepTutor-style research brief with question, evidence, findings, limitations, glossary and cited source extracts",
  personalized: "DeepTutor-style personalized study plan with diagnostic assumptions, sequence, daily activities, mastery checks and remediation",
  quiz_bank: "DeepTutor-style quiz bank containing MCQ, true/false, short answer and application questions with answers and explanations",
  memory: "DeepTutor-style learner-memory record with mastered concepts, weak concepts, misconceptions, preferences and recommended next actions"
};

export async function POST(req: Request) {
  // Signed-in users only — this endpoint spends the app's server-side
  // Gemini key (GEMINI_API_KEY); leaving it open lets anyone on the
  // internet drain the quota anonymously.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in to use this feature." }, { status: 401 });
  }

  const { materialType, topic, documentId, grade="8", languageId="english", learnerProfile="", apiKey } = await req.json();
  if (!specs[materialType] || !topic) return NextResponse.json({error:"Valid material type and topic are required"},{status:400});
  const hits = await search(topic, 10, documentId);
  if (!hits.length) return NextResponse.json({error:"No relevant textbook material found. Index a textbook first."},{status:404});
  const context = hits.map((h,i)=>`[S${i+1}] ${h.documentName}, page ${h.page}: ${h.text}`).join("\n\n");
  const fallbackBase = normalizeMaterialVisuals({
    title: `${topic} — ${materialType.replaceAll("_"," ")}`,
    engine: ["classroom","ppt","web_lesson","simulation","whiteboard","discussion"].includes(materialType)?"OpenMAIC":"DeepTutor",
    sections: hits.slice(0,6).map((h,i)=>({heading:`Section ${i+1}`,content:h.text.slice(0,600),source:`S${i+1} · page ${h.page}`})),
    sources: hits.map((h,i)=>({id:`S${i+1}`,page:h.page,document:h.documentName,text:h.text.slice(0,220)}))
  });
  const fallback={...fallbackBase,sections:(fallbackBase.sections||[]).map((section:any)=>({...section,whiteboardCommands:normalizeWhiteboardPlan(section.whiteboardCommands,[section.heading,section.content].filter(Boolean))}))};
  try {
    const prompt = `Create a ${specs[materialType]} for a Class ${grade} learner. Use ONLY the textbook extracts. ${languageInstruction(languageId)} Learner profile: ${learnerProfile||"not supplied"}. Return raw JSON with this stable shape: {"title":"...","engine":"OpenMAIC|DeepTutor","overview":"...","sections":[{"heading":"...","content":"...","activity":"...","answer":"...","sourceIds":["S1"],"visual":{...validated Visual object...},"whiteboardCommands":{"version":1,"autoplay":true,"commands":[{"id":"l1","action":"write","text":"first key line","durationMs":1500},{"id":"l2","action":"write","text":"next point","durationMs":1500},{"id":"m1","action":"underline","target":"l2","durationMs":700}]}}],"sources":[{"id":"S1","page":1,"document":"...","text":"..."}]}. Adapt section content to the requested material type. ${VISUAL_JSON_INSTRUCTION} ${WHITEBOARD_COMMAND_JSON_INSTRUCTION} Include 6-12 useful sections/items and cite source IDs.`;
    const raw = await callGemini(prompt, `TOPIC: ${topic}\nMATERIAL TYPE: ${materialType}\n\nTEXTBOOK EXTRACTS:\n${context}`, { maxOutputTokens: 16384, json: true }, apiKey);
    const base=normalizeMaterialVisuals(parseAiJson(raw)); const material={...base,sections:(base.sections||[]).map((section:any)=>({...section,whiteboardCommands:normalizeWhiteboardPlan(section.whiteboardCommands,[section.heading,section.content].filter(Boolean))}))}; return NextResponse.json({material});
  } catch {
    return NextResponse.json({material:fallback, warning:"AI provider unavailable; generated an extractive fallback."});
  }
}
