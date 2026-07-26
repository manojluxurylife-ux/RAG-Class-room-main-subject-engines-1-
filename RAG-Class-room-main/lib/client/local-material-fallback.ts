"use client";
/**
 * Local (no-Gemini) study material generation — the fallback path for
 * when the server's Gemini call fails (quota, Google blocking a key,
 * no internet). Runs entirely in the student's browser using the two
 * offline models this app supports:
 *
 *   1. Qwen3.5-0.8B, VISION mode (lib/offline-ai.ts) — reads the
 *      uploaded textbook-page photo and extracts its content as plain
 *      text. VibeThinker-3B has no vision capability at all, so this
 *      step has to happen first and separately — see the honest
 *      discussion of this in lib/offline-ai-vibethinker.ts.
 *   2. VibeThinker-3B (lib/offline-ai-vibethinker.ts) — takes that
 *      extracted text and does the actual reasoning/structuring work:
 *      turning raw textbook content into a taught segment (teaching
 *      points + a worked example). Generated in ENGLISH regardless of
 *      the student's target language — VibeThinker's own multilingual
 *      ability, especially for Indian languages, is unverified and
 *      likely weak (see that file's comments) — better to get this
 *      part right in a language it's actually good at.
 *   3. Qwen3.5-0.8B, TEXT mode — translates VibeThinker's English
 *      output into the student's target language, if it isn't already
 *      English. Skipped entirely for English-medium students.
 *
 * HONEST SCOPE: this covers the FIRST segment only — the foundational
 * "Notes"-style content every study material starts from — not the
 * other ten material types (PPT, MCQ, Flashcards, etc., generated via
 * a separate route) and not multi-segment continuation (the server's
 * roadmap-based "generate the rest" flow also needs Gemini). A student
 * whose local fallback kicks in gets ONE complete, usable segment
 * instead of nothing — not full parity with a working Gemini call.
 * Also does not attempt diagrams/visuals or textbook page-cue
 * highlighting that the Gemini path supports — kept out deliberately
 * for reliability, since asking a 3B local model for more deeply
 * nested JSON increases the odds of a malformed response.
 *
 * REQUIRES: both offlineAI's vision mode AND offlineVibeThinker must
 * already be downloaded (see Settings) — there is no server fallback
 * within this fallback; if either model isn't ready, this throws
 * immediately with a clear message rather than trying and failing
 * halfway through.
 */
import { offlineAI } from "@/lib/offline-ai";
import { offlineVibeThinker } from "@/lib/offline-ai-vibethinker";

export interface LocalSegmentResult {
  title: string;
  firstSegment: {
    heading: string;
    points: string[];
    example?: { problem: string; steps: string[]; answer: string };
  };
}

function extractJson(raw: string): any {
  // Local models are far less reliable than Gemini about honoring
  // "raw JSON only" — strip markdown fences and grab the outermost
  // {...} block before parsing, rather than trusting the response is
  // clean JSON as-is.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found in the model's response.");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function canRunLocalMaterialFallback(): Promise<boolean> {
  return offlineAI.getVisionStatus() === "ready" && offlineVibeThinker.getStatus() === "ready";
}

/**
 * Runs the full 3-stage pipeline. Throws with a specific, actionable
 * message at whichever stage fails, rather than a generic error — the
 * calling UI shows this directly to the student.
 */
export async function generateSegmentLocally(
  imageBytes: ArrayBuffer,
  { subject, className, syllabus, sourceLanguage, targetLanguage }: {
    subject: string; className: string; syllabus: string; sourceLanguage: string; targetLanguage: string;
  },
  onStage?: (stage: "reading" | "generating" | "translating") => void,
): Promise<LocalSegmentResult> {
  if (offlineAI.getVisionStatus() !== "ready") {
    throw new Error("Local fallback needs the offline camera/vision model downloaded first (Settings → Brain2 → enable camera).");
  }
  if (offlineVibeThinker.getStatus() !== "ready") {
    throw new Error("Local fallback needs VibeThinker-3B downloaded first (Settings → Extra offline brain).");
  }

  // ── Stage 1: Qwen3.5 vision reads the page ──
  onStage?.("reading");
  const extractedText = await offlineAI.generateWithImage(
    `You are reading a photographed textbook page written in ${sourceLanguage}, for a Class ${className} ${subject} student (${syllabus} syllabus). ` +
    `Transcribe and describe everything on it in plain English: the main text, any worked examples, any diagrams (describe what they show). ` +
    `Be thorough — this is the only source another process will have to work from.`,
    "Extract and describe everything on this textbook page.",
    imageBytes,
  );
  if (!extractedText.trim()) throw new Error("Couldn't read anything from this page — try a clearer photo.");

  // ── Stage 2: VibeThinker structures it into a taught segment (English) ──
  onStage?.("generating");
  const genSystem =
    `You are an expert ${subject} teacher preparing ONE structured teaching segment from extracted textbook content, ` +
    `for a Class ${className} student (${syllabus} syllabus). Base everything strictly on the provided content — never invent facts or formulas not present in it. ` +
    `Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape: ` +
    `{"title": string, "heading": string, "points": [3 to 5 short teaching points], "example": {"problem": string, "steps": [2 to 4 steps], "answer": string}}. ` +
    `Omit "example" only if the content genuinely has no worked problem to teach from. Write everything in English.`;
  const genRaw = await offlineVibeThinker.generate(genSystem, `Textbook page content:\n\n${extractedText}\n\nGenerate the teaching segment now.`);
  let parsed: any;
  try { parsed = extractJson(genRaw); }
  catch { throw new Error("VibeThinker's response wasn't valid — try again, or try a clearer/simpler page."); }
  if (!parsed.heading || !Array.isArray(parsed.points) || !parsed.points.length) {
    throw new Error("VibeThinker's response was missing required fields — try again.");
  }

  let segment = {
    heading: String(parsed.heading),
    points: parsed.points.map((p: any) => String(p)),
    example: parsed.example && parsed.example.problem ? {
      problem: String(parsed.example.problem),
      steps: Array.isArray(parsed.example.steps) ? parsed.example.steps.map((s: any) => String(s)) : [],
      answer: String(parsed.example.answer || ""),
    } : undefined,
  };
  let title = String(parsed.title || segment.heading);

  // ── Stage 3: Qwen3.5 translates, only if the target isn't English ──
  const isEnglish = /^en(glish)?$/i.test(targetLanguage);
  if (!isEnglish) {
    onStage?.("translating");
    const translateSystem =
      `Translate the following JSON object's string values into ${targetLanguage}, in its native script (never transliterate into Latin letters). ` +
      `Keep the exact same JSON structure and keys — translate ONLY the string values, not the keys. Respond ONLY with raw JSON, no markdown fences, no preamble.`;
    const toTranslate = JSON.stringify({ title, heading: segment.heading, points: segment.points, example: segment.example });
    try {
      const translatedRaw = await offlineAI.generate(translateSystem, toTranslate);
      const translated = extractJson(translatedRaw);
      if (translated.title) title = String(translated.title);
      if (translated.heading) segment.heading = String(translated.heading);
      if (Array.isArray(translated.points) && translated.points.length) segment.points = translated.points.map((p: any) => String(p));
      if (translated.example && segment.example) {
        segment.example = {
          problem: String(translated.example.problem || segment.example.problem),
          steps: Array.isArray(translated.example.steps) && translated.example.steps.length ? translated.example.steps.map((s: any) => String(s)) : segment.example.steps,
          answer: String(translated.example.answer || segment.example.answer),
        };
      }
    } catch {
      // Translation failing is not fatal — the English version is
      // still a complete, usable segment. Better to hand the student
      // something than nothing because the last, optional step broke.
      console.error("[local-material-fallback] translation stage failed, returning English content");
    }
  }

  return { title, firstSegment: segment };
}
