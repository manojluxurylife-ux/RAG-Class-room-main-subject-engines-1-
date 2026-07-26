// Shared prompt logic + AI calls for all teaching API routes.
// Backed by Google Gemini — chosen because it has a usable free tier
// (unlike Claude, which has no free API plan), making this deployable on
// Vercel/Netlify free tiers without a billing setup.
//
// MODEL NOTE: Flash Lite is the cheapest/fastest Gemini tier, but its
// reasoning and instruction-following are noticeably weaker — for a
// child-facing maths teacher, that shows up as confusing or badly-paced
// explanations. "gemini-2.5-flash" (not Lite) is still free-tier eligible
// on Google AI Studio and is a meaningfully better teacher. If quality is
// still not good enough, the next step up is "gemini-2.5-pro" (lower free
// quota, but the strongest reasoning) — or moving to Claude once you have
// paying users (see lib/teacher-prompts.ts history / README for that swap).
//
// Get a free key at https://aistudio.google.com/app/apikey
// Set it as GEMINI_API_KEY in your hosting provider's environment variables.
import { BIOLOGY_DIAGRAM_IDS } from "./biology-diagrams";

const LANGUAGE_NAMES: Record<string, string> = {
  english:   "English",
  // Not an Eighth Schedule language — added for the Gulf market, where
  // CBSE-affiliated Indian schools are common; genuinely high
  // confidence given Arabic's much larger digital footprint than the
  // Indian regional languages below. Modern Standard Arabic (الفصحى),
  // the formal register used in education across the Arab world.
  arabic:    "Arabic (العربية)",
  malayalam: "Malayalam (മലയാളം)",
  tamil:     "Tamil (தமிழ்)",
  kannada:   "Kannada (ಕನ್ನಡ)",
  hindi:     "Hindi (हिन्दी)",
  telugu:    "Telugu (తెలుగు)",
  // All 22 languages of the Eighth Schedule of the Constitution are now
  // covered (the six above, plus these sixteen) — see
  // lib/setup-voice-scripts.ts for the honest, tiered confidence note
  // on translation/voice quality, since that varies a lot more across
  // this group than it did for the original six.
  bengali:   "Bengali (বাংলা)",
  marathi:   "Marathi (मराठी)",
  gujarati:  "Gujarati (ગુજરાતી)",
  punjabi:   "Punjabi (ਪੰਜਾਬੀ)",
  urdu:      "Urdu (اردو)",           // written right-to-left — see the honest UI note in lib/setup-voice-scripts.ts
  odia:      "Odia (ଓଡ଼ିଆ)",
  assamese:  "Assamese (অসমীয়া)",
  nepali:    "Nepali (नेपाली)",
  sanskrit:  "Sanskrit (संस्कृतम्)",
  konkani:   "Konkani (कोंकणी)",
  kashmiri:  "Kashmiri (کٲشُر)",       // written right-to-left, like Urdu
  maithili:  "Maithili (मैथिली)",
  manipuri:  "Manipuri (মৈতৈলোন্)",   // Bengali script — the common digital form; Meitei Mayek has very limited font/device support
  dogri:     "Dogri (डोगरी)",
  bodo:      "Bodo (बड़ो)",
  sindhi:    "Sindhi (سنڌي)",          // written right-to-left, like Urdu
  santali:   "Santali (ᱥᱟᱱᱛᱟᱲᱤ)",     // Ol Chiki script — real, but has the most limited digital ecosystem of this whole group
};

const BOARD_NAMES: Record<string, string> = {
  cbse:      "CBSE (NCERT)",
  kerala:    "Kerala State Syllabus (SCERT)",
  tamilnadu: "Tamil Nadu State Board",
  karnataka: "Karnataka State Board (KSEEB)",
};

export function languageName(id: string) { return LANGUAGE_NAMES[id] || "English"; }
export function boardName(id: string)    { return BOARD_NAMES[id]    || "CBSE (NCERT)"; }

export function languageInstruction(languageId: string) {
  if (languageId === "english" || !languageId) {
    return "Respond entirely in clear, simple English.";
  }
  return `Respond entirely in ${languageName(languageId)}, written in its native script — do not transliterate into Latin letters and do not switch into English. Keep numerals as plain digits (0-9) and keep standalone mathematical symbols (+, -, ×, ÷, =) as they are.`;
}

// Maps a class number to concrete vocabulary/pacing constraints. Generic
// instructions like "explain simply" don't reliably work on smaller/cheaper
// models — naming the actual constraint (sentence length, what NOT to
// assume the child already knows, what to use instead of jargon) does.
export function gradeBandGuidance(grade: string): string {
  const g = parseInt(grade, 10) || 8;
  if (g <= 6) {
    return `This student is young (Class ${grade}). Use very short sentences (under 12 words each). Use only objects from daily life as examples — chapatis, mangoes, rupees, cricket, toy cars, sweets shared between friends. Never introduce a maths term without immediately explaining it in one plain phrase right after. Avoid multi-step abstract reasoning in a single sentence — break every idea into its own short sentence.`;
  }
  if (g <= 8) {
    return `This student is Class ${grade} (early teens). Use short, direct sentences. Introduce each technical term once, explain it in everyday words the first time it appears, then you may reuse it. Use one concrete real-world example (money, distance, time, sports scores, sharing food) before any abstract explanation — never the other way round.`;
  }
  return `This student is Class ${grade} (older, exam-focused). You can use standard maths vocabulary, but still define any term that's central to the topic the first time it appears. Keep explanations exam-relevant and avoid unnecessary tangents.`;
}

export function lessonSystemPrompt({
  grade, boardId, languageId, fromTextbook = false,
}: {
  grade: string;
  boardId: string;
  languageId: string;
  fromTextbook?: boolean;
}) {
  const ctx = `You are AI Guru, a warm and patient Indian school maths teacher.
You are teaching a Class ${grade} student who follows the ${boardName(boardId)} syllabus.
${gradeBandGuidance(grade)}
${languageInstruction(languageId)}

GROUNDING — stay strictly on the exact topic requested. Never invent formulas, terminology, or facts that aren't genuinely correct for this grade and syllabus — if you're unsure a detail is accurate, leave it out rather than guessing.`;

  const instruction = fromTextbook
    ? `The student has photographed or scanned a page from their textbook. Look carefully at ALL the text, diagrams, equations, and worked examples visible on that page. Identify the key maths concept and teach it step by step.

SPOTLIGHTS — the app shows the textbook page beside your lesson and can shine a spotlight on one passage while you teach. For this, include a "spotlights" array with EXACTLY the same number of entries as "points": for each teaching point, the exact phrase (4 to 12 words) copied VERBATIM, character for character, from the page that the point refers to — or "" if that point doesn't come from a specific line. Verbatim matters: the app searches the page for the literal phrase; a paraphrase finds nothing and the spotlight silently fails.`
    : `Explain the requested topic step by step, building from something the student already knows toward the new idea — never start with a definition the student has no context for.`;

  return `${ctx}
${instruction}

CRITICAL RULES FOR THE WORKED EXAMPLE:
- Each step must show the REASONING, not just jump to a number. Bad: "3/4 + 1/4 = 1". Good: "Both pieces already have 4 as the bottom number, so we just add the top numbers: 3 + 1 = 4, giving 4/4, which is a whole one."
- Use a concrete, countable, relatable object in the example (fruit, money, friends sharing something, distance walked) — never an abstract "x" or "a number" with no context, especially for younger classes.
- The final "answer" field should state the result AND restate what it means in plain words (e.g. "2/3, meaning two out of every three pieces").

OPTIONAL VISUAL — include a "visual" field ONLY if a diagram would genuinely help this specific topic (skip it entirely for topics with no natural visual, like word problems about time). When you do include one:
- You NEVER supply pixel coordinates, SVG paths, or drawing instructions — only the small set of numbers/text listed below. A real renderer computes the actual drawing from these.
- Pick exactly ONE of these shapes, matching the "type" field name exactly:
  {"type":"fraction","numerator":N,"denominator":N,"style":"bar"|"pie"}
  {"type":"number-line","min":N,"max":N,"points":[{"value":N,"label":"text"}]}
  {"type":"geometry","shape":"triangle"|"right-triangle"|"circle"|"rectangle","sides":[N,N,N],"legs":[N,N],"radius":N,"width":N,"height":N}
  {"type":"graph","expression":"x^2 - 4","domain":[N,N],"label":"text"}
  {"type":"bar-chart","labels":["a","b"],"values":[N,N],"label":"text"}
  {"type":"flowchart","mermaidSyntax":"graph TD; A[Start] --> B{Is n even?}"}
  {"type":"solid-3d","shape":"cone"|"cylinder"|"sphere"|"cube","radius":N,"height":N,"side":N}
  {"type":"geogebra","commands":["A = (0, 0)","B = (4, 0)","C = (4, 3)","Polygon(A, B, C)"],"caption":"text"}
  {"type":"molecule","smiles":"CCO","caption":"text"}
  {"type":"circuit","components":[{"kind":"battery","label":"6V"},{"kind":"switch"},{"kind":"resistor","label":"R"},{"kind":"ammeter"}],"caption":"text"}
  {"type":"biology-diagram","diagramId":"plant-cell"|"animal-cell","caption":"text"}
- "geometry" and "solid-3d" only need the fields relevant to the chosen shape — omit the rest.
- Use "geogebra" ONLY when the geometry genuinely benefits from being interactive/draggable (e.g. showing how a triangle's angles change as a vertex moves) — for a simple fixed shape, "geometry" is lighter-weight. Commands must be real GeoGebra input-bar syntax, never pixel coordinates or drawing instructions of your own invention.
- Use "molecule" for a specific chemical structure — "smiles" must be a real, standard SMILES string for the actual molecule (e.g. water is "O", ethanol is "CCO") — never invented notation.
- Use "circuit" for a simple series circuit (2-6 components, one loop) — list components in real circuit order. Valid kinds: "battery", "resistor", "switch", "ammeter", "voltmeter", "bulb".
- Use "biology-diagram" ONLY for cell structure — "diagramId" MUST be exactly one of: ${BIOLOGY_DIAGRAM_IDS.map(id => `"${id}"`).join(", ")}. Never invent a different id — omit this visual if the topic isn't cell structure.
- "graph".expression must be valid maths notation only (e.g. "x^2 - 4", "2*x + 1") — nothing else, since it is evaluated by a maths library, not run as code.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"title": string, "points": [3 to 4 short teaching points, each one sentence, building logically from simple to the new idea], "spotlights": <ONLY when teaching from a textbook page: array of verbatim phrases from the page, same length as "points", "" where none — omit entirely otherwise>, "example": {"problem": string, "steps": [2 to 4 steps, each containing real reasoning as shown above], "answer": string}, "checkQuestion": string, "visual": <optional, one of the shapes above, or omit entirely>}

All string values must be in the specified language. Write maths in plain words, not LaTeX (e.g. "three quarters" or "3/4", not "\\frac{3}{4}"). Keep every string short enough to read aloud in one breath — if a sentence needs a comma to fit an idea, split it into two sentences instead.`;
}

export function qaSystemPrompt({
  topic, grade, boardId, languageId,
}: {
  topic: string; grade: string; boardId: string; languageId: string;
}) {
  return `You are AI Guru, continuing the same maths class on "${topic}" for a Class ${grade} student following the ${boardName(boardId)} syllabus. The student just asked a follow-up question.
${gradeBandGuidance(grade)}
Answer warmly in 2 to 4 short sentences, like a patient teacher standing at the board — if the question reveals a misunderstanding, gently address it with a fresh small example rather than just repeating the same explanation. ${languageInstruction(languageId)} Plain text only, no markdown, no LaTeX.`;
}

// ── Gemini API ──────────────────────────────────────────────────────────────

export const MODEL = "gemini-3.1-flash-lite";

function getApiKey(override?: string) {
  const key = override || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/app/apikey " +
      "and add it to your environment variables (.env.local locally, or your Vercel/Netlify project settings).",
    );
  }
  return key;
}

function endpoint(apiKeyOverride?: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${getApiKey(apiKeyOverride)}`;
}

function extractText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => p.text || "").join("\n");
}

// Text-only lesson / Q&A call.
// The default 1536-token budget suits short Q&A. Structured generators
// (full lessons, exam papers) MUST pass a larger maxOutputTokens — at
// 1536 a multi-scene lesson JSON always truncated, always failed to
// parse, and the caller silently served its plain-text fallback. That
// was the root cause of "RAG classroom shows only plain text".
export interface GeminiCallOptions { maxOutputTokens?: number; json?: boolean }
export async function callGemini(system: string, userContent: string, options: GeminiCallOptions = {}, apiKeyOverride?: string) {
  const res = await fetch(endpoint(apiKeyOverride), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        maxOutputTokens: options.maxOutputTokens ?? 1536,
        temperature: 0.4,
        ...(options.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const text = extractText(data);
  if (!text) throw new Error("Gemini returned an empty response (it may have been blocked by safety filters).");
  return text;
}

// Vision call — used for textbook page photos / PDFs
export async function callGeminiWithImage(
  system: string,
  textPrompt: string,
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  apiKeyOverride?: string
) {
  const res = await fetch(endpoint(apiKeyOverride), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: textPrompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini vision error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const text = extractText(data);
  if (!text) throw new Error("Gemini returned an empty response (it may have been blocked by safety filters).");
  return text;
}
