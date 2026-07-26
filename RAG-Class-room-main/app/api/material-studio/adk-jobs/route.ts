import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { adkMaterialJobs } from "@/lib/adk-material-jobs";
import { adkCloudTasksConfigured, enqueueAdkMaterialJob } from "@/lib/cloud-tasks";

import { serverAiEnabledOnServer } from "@/lib/ai-features";
export const runtime = "nodejs";

function compactExtracts(extracts: any[]): string {
  let total = 0;
  const limit = 50000;
  const parts: string[] = [];
  for (let i = 0; i < Math.min(extracts.length, 16); i++) {
    const x = extracts[i] || {};
    const text = String(x.text || "").replace(/\s+/g, " ").trim();
    const piece = `[S${i + 1} | page ${Number(x.page || 0)} | ${String(x.document || "Textbook")} ]\n${text}`;
    if (total + piece.length > limit) break;
    total += piece.length;
    parts.push(piece);
  }
  return parts.join("\n\n");
}

export async function POST(req: Request) {
  if (!serverAiEnabledOnServer()) return NextResponse.json({ error: "Managed Server AI is temporarily disabled." }, { status: 503 });
  try {
    const session = await requireStudent();
    if (!adkCloudTasksConfigured()) {
      return NextResponse.json({ error: "ADK Cloud Tasks worker is not configured." }, { status: 503 });
    }
    const body = await req.json();
    const { input, extracts } = body || {};
    if (!input || typeof input.topic !== "string" || typeof input.materialType !== "string" || !Array.isArray(extracts) || !extracts.length) {
      return NextResponse.json({ error: "Material input and textbook extracts are required." }, { status: 400 });
    }
    const context = compactExtracts(extracts);
    if (!context) return NextResponse.json({ error: "No readable textbook context was supplied." }, { status: 400 });
    const prompt = `Create a complete ${input.materialType} study material for Class ${input.grade || "8"}.\nTopic: ${input.topic}\nLanguage: ${input.languageId || "english"}\nLearner profile: ${input.learnerProfile || "not supplied"}\n\nUse ONLY the source packet below. Preserve source IDs in every section. Produce real renderable Visual JSON objects, assessments with answers, a strict QA report, and a repaired final material when QA score is below 85. Return raw JSON only.\n\nSOURCE PACKET:\n${context}`;
    const now = new Date().toISOString();
    const job = await adkMaterialJobs.create({
      ownerId: session.userId,
      status: "queued",
      stage: "queued",
      progress: 5,
      input,
      prompt,
      createdAt: now,
      updatedAt: now,
    });
    try {
      const taskName = await enqueueAdkMaterialJob({ jobId: job.id, userId: session.userId });
      await adkMaterialJobs.update(job.id, { taskName, updatedAt: new Date().toISOString() });
    } catch (error: any) {
      await adkMaterialJobs.update(job.id, { status: "failed", stage: "queue_failed", progress: 0, error: error?.message || "Cloud Tasks enqueue failed", updatedAt: new Date().toISOString() });
      throw error;
    }
    return NextResponse.json({ jobId: job.id, status: "queued" }, { status: 202 });
  } catch (error: any) {
    const status = error?.status || (String(error?.message || "").includes("Authentication") ? 401 : 500);
    return NextResponse.json({ error: error?.message || "Could not create ADK job." }, { status });
  }
}
