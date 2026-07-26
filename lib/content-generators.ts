/**
 * Prompt templates for the Admin Content Creator Studio.
 * Each "kind" produces a different structured artefact via Gemini, all
 * returned as markdown text (simplest universal format — renders directly,
 * exports cleanly to PDF/Word later, and is what teachers actually want
 * to copy into their own documents).
 *
 * Design note: unlike the student-facing /api/lesson (which returns strict
 * JSON for the typewriter UI), these are teacher-facing authoring tools —
 * markdown gives the teacher something immediately useful and editable.
 *
 * QUIZ/NOTES RICHNESS — adopted from an evaluation of THU-MAIC/OpenMAIC
 * (now MIT-licensed) and a wishlist document for OpenVidya (which has no
 * actual code — verified directly, 3 files total in that repo). See
 * README's "Adopted vs rejected" section for the full accounting: most of
 * what's genuinely valuable here collapses into richer PARAMETERS on the
 * existing quiz/revision-notes generators, not new material kinds —
 * Assertion-Reason, Match-the-following, HOTS, Case-study, and
 * Competency-based questions are all real Indian exam formats (CBSE uses
 * several of these directly), so this isn't feature-bloat, it's filling
 * a real gap in exam-relevant content variety.
 */

import { boardName, languageInstruction, gradeBandGuidance } from "./teacher-prompts";
import { findConceptChapter, formatConceptChapterForPrompt } from "./concept-kb";
import { BIOLOGY_DIAGRAM_IDS } from "./biology-diagrams";

export type MaterialKind =
  | "lesson-plan" | "slides" | "quiz" | "flashcards" | "mind-map"
  | "lab-manual" | "voice-script" | "revision-notes";

export const MATERIAL_KINDS: { id: MaterialKind; label: string; description: string }[] = [
  { id: "lesson-plan",    label: "Lesson Plan",     description: "Objectives, structure, timing, and assessment for a full class period" },
  { id: "slides",         label: "Slide Deck",       description: "Slide-by-slide outline with talking points, ready to paste into PPT" },
  { id: "quiz",           label: "Quiz",             description: "MCQ, Assertion-Reason, HOTS, case-study & more — real exam formats" },
  { id: "flashcards",     label: "Flash Cards",      description: "Front/back term-definition pairs, with optional mnemonics" },
  { id: "mind-map",       label: "Mind Map",         description: "Concept map, dependency graph, or decision tree outline" },
  { id: "lab-manual",     label: "Lab Manual",       description: "Step-by-step practical/activity instructions with materials list" },
  { id: "voice-script",   label: "Voice Script",     description: "A narration script, or a role-play dialogue between two voices" },
  { id: "revision-notes", label: "Revision Notes",   description: "Chapter summary, formula sheet, definitions, or full notes" },
];

// ── Quiz question formats — real Indian exam formats, not invented ones ────
export const QUIZ_FORMATS = [
  { id: "mcq",              label: "Multiple Choice" },
  { id: "assertion-reason", label: "Assertion–Reason" },
  { id: "match-following",  label: "Match the Following" },
  { id: "fill-blank",       label: "Fill in the Blanks" },
  { id: "true-false",       label: "True / False" },
  { id: "short-answer",     label: "Short Answer" },
  { id: "long-answer",      label: "Long Answer" },
  { id: "hots",              label: "HOTS (Higher Order Thinking)" },
  { id: "case-study",       label: "Case Study" },
  { id: "competency-based", label: "Competency-Based" },
  { id: "mixed",             label: "Mixed (a bit of everything)" },
] as const;
export type QuizFormat = typeof QUIZ_FORMATS[number]["id"];

export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const;
export type QuizDifficulty = typeof QUIZ_DIFFICULTIES[number];

export const EXAM_STYLES = [
  { id: "standard",       label: "Standard" },
  { id: "previous-year",  label: "Previous-Year Board Exam Style" },
  { id: "ncert-exemplar", label: "NCERT Exemplar Style" },
] as const;
export type ExamStyle = typeof EXAM_STYLES[number]["id"];

// ── Revision notes sub-types ────────────────────────────────────────────────
export const NOTES_SUBTYPES = [
  { id: "standard",         label: "Full Revision Notes" },
  { id: "chapter-summary",  label: "Chapter Summary" },
  { id: "definitions",      label: "Important Definitions" },
  { id: "formula-sheet",    label: "Formula Sheet" },
  { id: "vocabulary",       label: "Vocabulary List" },
  { id: "important-dates",  label: "Important Dates" },
  { id: "key-points",       label: "Key Points Only" },
] as const;
export type NotesSubtype = typeof NOTES_SUBTYPES[number]["id"];

// ── Lesson-plan / voice-script delivery style ───────────────────────────────
export const LESSON_STYLES = [
  { id: "standard",     label: "Standard" },
  { id: "story-based",  label: "Story-Based" },
  { id: "role-play",    label: "Role-Play Dialogue" },
] as const;
export type LessonStyle = typeof LESSON_STYLES[number]["id"];

export const MINDMAP_TYPES = [
  { id: "standard",      label: "Mind Map" },
  { id: "concept-map",   label: "Concept Map" },
  { id: "dependency",    label: "Concept Dependency Graph" },
  { id: "decision-tree", label: "Decision Tree" },
] as const;
export type MindmapType = typeof MINDMAP_TYPES[number]["id"];

export interface GenParams {
  topic:      string;
  subject:    string;
  grade:      string;
  boardId:    string;
  languageId: string;
  // All optional, all backward-compatible — existing callers that don't
  // pass these get exactly the previous default behaviour.
  quizFormat?:     QuizFormat;
  quizDifficulty?: QuizDifficulty;
  examStyle?:      ExamStyle;
  notesSubtype?:   NotesSubtype;
  lessonStyle?:    LessonStyle;
  mindmapType?:    MindmapType;
  includeMnemonics?: boolean;
  // True when this is generated from a student's own uploaded textbook
  // photo rather than a typed topic — swaps quoted-topic phrasing for a
  // natural reference and tells the AI to identify the topic from the
  // image first. See lib/study-materials-store.ts's "extras" field.
  sourceIsImage?: boolean;
}

function ctx({ subject, grade, boardId, languageId }: GenParams) {
  return `You are an experienced ${subject} teacher preparing material for a Class ${grade} class following the ${boardName(boardId)} syllabus.
${gradeBandGuidance(grade)}
${languageInstruction(languageId)}

GROUNDING — stay strictly on the exact topic given. Never invent terminology, formulas, or facts that don't genuinely belong to this topic and grade level — if you're not confident a fact is accurate for this specific syllabus/grade, leave it out rather than guessing. Do not pad content with tangentially-related material to hit a length target.`;
}

// ── Per-format quiz instruction fragments ───────────────────────────────────
export const QUIZ_FORMAT_INSTRUCTIONS: Record<QuizFormat, string> = {
  "mcq": `8 multiple-choice questions, 4 options each, one correct answer.`,
  "assertion-reason": `8 Assertion-Reason questions in the standard CBSE format: an "Assertion (A)" statement and a "Reason (R)" statement, with the student choosing from: (a) Both A and R are true, R is the correct explanation of A; (b) Both A and R are true, R is NOT the correct explanation of A; (c) A is true, R is false; (d) A is false, R is true.`,
  "match-following": `2 Match-the-Following sets, each with 5 items in Column A and 5 items in Column B (shuffled, not in matching order) for the student to pair up.`,
  "fill-blank": `10 Fill-in-the-Blank sentences, each with exactly one blank testing a key term or fact.`,
  "true-false": `10 True/False statements, roughly half true and half false, each testing a specific fact (not a trick/ambiguous statement).`,
  "short-answer": `6 Short-Answer questions, each answerable in 2-3 sentences.`,
  "long-answer": `4 Long-Answer questions, each requiring a structured multi-paragraph answer with reasoning.`,
  "hots": `6 HOTS (Higher Order Thinking Skills) questions — these should require applying, analyzing, or evaluating the concept in a new situation, not just recalling a fact. Avoid questions with a single-word or single-fact answer. For each question, in the Answer Key, explicitly name the most common WRONG answer students give and why they get it wrong ("Common mistake: ...") — this is more useful for exam prep than just stating the right answer.`,
  "case-study": `2 Case-Study questions: a short real-world scenario (3-5 sentences) followed by 3 sub-questions of increasing difficulty based on that scenario.`,
  "competency-based": `6 Competency-Based questions — each should test whether the student can apply the concept to solve a practical, real-life problem, in the style of CBSE's current competency-based assessment framework.`,
  "mixed": `10 questions total, mixing formats: 3 MCQ, 2 Assertion-Reason, 2 Short-Answer, 1 HOTS, 1 Case-Study, 1 Fill-in-the-Blank. For at least 2 questions, flag the most common wrong answer students give in the Answer Key ("Common mistake: ...").`,
};

export const EXAM_STYLE_INSTRUCTIONS: Record<ExamStyle, string> = {
  "standard": "",
  "previous-year": ` Write these in the phrasing and structure typical of actual previous-year board exam papers for this syllabus — formal exam language, standard mark-scheme-friendly phrasing.`,
  "ncert-exemplar": ` Match the difficulty and phrasing style of NCERT Exemplar problems — these are typically a step harder and more conceptual than the standard NCERT textbook questions.`,
};

export const DIFFICULTY_INSTRUCTIONS: Record<QuizDifficulty, string> = {
  "easy": " Keep every question at an easy, confidence-building difficulty — direct recall or simple one-step application.",
  "medium": " Keep every question at a moderate difficulty — some reasoning or multi-step application required.",
  "hard": " Keep every question genuinely challenging — multi-step reasoning, edge cases, or combining more than one concept.",
  "mixed": " Vary the difficulty across the set: roughly a third easy, a third medium, a third hard — label each question's difficulty in brackets, e.g. \"[Easy]\".",
};

const NOTES_SUBTYPE_INSTRUCTIONS: Record<NotesSubtype, string> = {
  "standard": `Write condensed, exam-ready revision notes. Use markdown headers for each sub-concept, bullet points for facts/formulas, and **bold** the terms most likely to appear in an exam. Keep it dense but scannable — a student should be able to review this in under 5 minutes the night before an exam.`,
  "chapter-summary": `Write a single-page chapter summary — 4-6 short paragraphs covering the chapter's main narrative arc (what it introduces, why it matters, how the ideas connect), NOT a bullet-point fact list. This should read like a compressed retelling a student could use to remember "what was this chapter actually about."`,
  "definitions": `List every important definition from this topic. Format each as "**Term** — definition" on its own line, grouped under markdown headers if there are natural sub-groups. Definitions should be precise and exam-quotable, not paraphrased loosely.`,
  "formula-sheet": `List every formula relevant to this topic. For each formula, write it using LaTeX notation wrapped in single dollar signs for inline math (e.g. "Area of a circle: $A = \\pi r^2$") — this will be rendered as real typeset mathematics, not shown as raw text. State what each symbol means in plain words right after, and a one-line note on when to use it. Group related formulas under markdown headers.`,
  "vocabulary": `List every subject-specific vocabulary word introduced in this topic, each with a short (under 15 words) plain-language meaning. Order alphabetically within any natural groupings.`,
  "important-dates": `List every important date/event relevant to this topic (most relevant for History/Geography/Civics content — if this topic genuinely has no dates, say so plainly instead of inventing irrelevant ones). Format as "**Date** — what happened and why it matters".`,
  "key-points": `List ONLY the highest-priority facts a student must know — no more than 10-15 bullet points total, each one sentence, no sub-explanation. This is the "if you only have 2 minutes" version.`,
};

const LESSON_STYLE_INSTRUCTIONS: Record<LessonStyle, string> = {
  "standard": "",
  "story-based": ` Frame the entire explanation as a short narrative/story with relatable characters encountering this concept — the teaching content should emerge naturally from the story, not be bolted on afterward. Keep the story grounded in a setting Indian school students would recognize.`,
  "role-play": ` Write this as a role-play DIALOGUE between two characters (e.g. a curious student and a patient teacher, or two students figuring it out together) — alternating short lines of dialogue, not narration. The concept should be taught entirely through their back-and-forth conversation.`,
};

const MINDMAP_TYPE_INSTRUCTIONS: Record<MindmapType, string> = {
  "standard": `Create a hierarchical mind map outline as nested markdown bullets (indentation for sub-levels, up to 3 levels deep). Start with the central topic as the top-level heading, then 3-5 main branches, each with 2-4 sub-points.`,
  "concept-map": `Create a concept map showing how ideas within this topic RELATE to each other, not just a hierarchy. Format as a markdown list of relationships: "**Concept A** → (relationship, e.g. 'causes', 'is a type of', 'depends on') → **Concept B**". List 8-15 such relationships that together map out the topic's conceptual structure.`,
  "dependency": `Create a concept DEPENDENCY graph — which ideas must be understood BEFORE which others. Format as real Mermaid flowchart syntax: "graph TD; A[Concept] --> B[Concept that depends on it];" — this will be rendered directly as a diagram, so the syntax must be valid Mermaid.`,
  "decision-tree": `Create a decision tree for working through this topic's core procedure/problem-type. Format as real Mermaid flowchart syntax with decision diamonds: "graph TD; A{Question?} -->|Yes| B[Next step]; A -->|No| C[Different step];" — this will be rendered directly as a diagram, so the syntax must be valid Mermaid.`,
};

export function buildSystemPrompt(kind: MaterialKind, params: GenParams): string {
  const base = ctx(params);
  const {
    quizFormat = "mcq", quizDifficulty = "medium", examStyle = "standard",
    notesSubtype = "standard", lessonStyle = "standard", mindmapType = "standard",
    includeMnemonics = false, sourceIsImage = false,
  } = params;

  // When generating from a photographed page (student's own upload) rather
  // than a typed topic, quoting a topic string would read awkwardly — use
  // a natural unquoted reference instead, and tell the AI to identify the
  // specific topic from the image first.
  const topicRef = sourceIsImage
    ? "the topic covered in the attached textbook page image"
    : `"${params.topic}"`;
  const visionInstruction = sourceIsImage
    ? " First identify the specific topic/concept shown on the attached page — read all text, diagrams, and examples on it carefully — then base everything below on exactly that."
    : "";

  const instructions: Record<MaterialKind, string> = {
    "lesson-plan": `Write a complete lesson plan for the topic ${topicRef}.${visionInstruction} Include: Learning Objectives (3-4 bullet points), Prerequisite Knowledge, Materials Needed, a time-boxed Lesson Structure (Introduction / Development / Practice / Closure, with approximate minutes for each), Key Questions to ask the class, and an Assessment/Exit Ticket idea. Use clear markdown headers.${LESSON_STYLE_INSTRUCTIONS[lessonStyle]}`,

    "slides": `Create a slide-by-slide outline for a presentation on ${topicRef}.${visionInstruction} Suitable for pasting into PowerPoint or Google Slides. For each slide give: a short Title, 2-4 bullet points of content, and a one-line Speaker Note. Aim for 8-12 slides covering intro, core concept(s), a worked example, and a summary. Format each slide as "### Slide N: <title>" followed by bullets and a "**Speaker note:**" line.`,

    "quiz": `Write a quiz on ${topicRef}.${visionInstruction} ${QUIZ_FORMAT_INSTRUCTIONS[quizFormat]}${DIFFICULTY_INSTRUCTIONS[quizDifficulty]}${EXAM_STYLE_INSTRUCTIONS[examStyle]} Number every question. After all questions, include a separate "## Answer Key" section with the correct answer for each question number, and a one-line explanation for each.`,

    "flashcards": `Create 12 flashcards for revising ${topicRef}.${visionInstruction} Format each as "**Card N**" followed by "Front: <term or question>" and "Back: <definition or answer>". Keep each side short enough to read at a glance — front under 10 words, back under 25 words.${
      includeMnemonics ? ` For at least 4 of the cards, add a "Mnemonic: <short memory aid>" line — a rhyme, acronym, or vivid mental image that makes the fact stick.` : ""
    }`,

    "mind-map": (() => {
      const base = `Topic: ${topicRef}.${visionInstruction} ${MINDMAP_TYPE_INSTRUCTIONS[mindmapType]}`;
      // Only "dependency" benefits from real grounding — a concept-map or
      // decision-tree isn't a fixed curriculum fact the same way a
      // prerequisite chain is. Falls through unchanged (exactly the
      // previous, ungrounded behavior) when the topic doesn't match the
      // curated seed set — this is deliberately a small seed (Class 10
      // CBSE Maths only for now, see lib/concept-kb.ts), not a claim of
      // full coverage.
      if (mindmapType !== "dependency" || sourceIsImage) return base;
      const chapter = findConceptChapter(params.topic, params.subject, params.grade);
      if (!chapter) return base;
      return `${base}\n\n${formatConceptChapterForPrompt(chapter)}`;
    })(),

    "lab-manual": `Write a lab/practical manual for an activity demonstrating ${topicRef}.${visionInstruction} Suitable for a school lab or classroom. Include: Objective, Materials/Apparatus Required (as a list), Safety Notes (if any), numbered Procedure steps, an Observations table description, and 2-3 Conclusion/Discussion questions for students to answer afterward.`,

    "voice-script": `Write a narration script for a ${params.grade}-minute-friendly audio lesson explaining ${topicRef}.${visionInstruction} As if a teacher is recording a voiceover for students to listen to. Write in natural spoken sentences (not bullet points), with [pause] markers where a brief pause helps comprehension, and occasional rhetorical questions to keep listeners engaged. Keep total length to about 300-400 words.${LESSON_STYLE_INSTRUCTIONS[lessonStyle]}`,

    "revision-notes": NOTES_SUBTYPE_INSTRUCTIONS[notesSubtype],
  };

  return `${base}\n\n${instructions[kind]}\n\nMATH NOTATION: wherever a real formula, equation, or mathematical expression appears, write it using LaTeX wrapped in single dollar signs for inline math ($...$) or double dollar signs for a standalone equation on its own line ($$...$$) — this content is rendered as real typeset mathematics, not shown as raw text. Use this for genuine formulas/equations only, not for simple counts or plain numbers.\n\nReturn ONLY the markdown content — no preamble like "Here is..." and no closing remarks.`;
}

export function defaultTitle(kind: MaterialKind, topic: string, params?: Partial<GenParams>): string {
  const labels: Record<MaterialKind, string> = {
    "lesson-plan": "Lesson Plan", "slides": "Slides", "quiz": "Quiz",
    "flashcards": "Flashcards", "mind-map": "Mind Map", "lab-manual": "Lab Manual",
    "voice-script": "Voice Script", "revision-notes": "Revision Notes",
  };
  let suffix = labels[kind];
  if (kind === "quiz" && params?.quizFormat && params.quizFormat !== "mcq") {
    suffix = QUIZ_FORMATS.find(f => f.id === params.quizFormat)?.label || suffix;
  }
  if (kind === "revision-notes" && params?.notesSubtype && params.notesSubtype !== "standard") {
    suffix = NOTES_SUBTYPES.find(n => n.id === params.notesSubtype)?.label || suffix;
  }
  if (kind === "mind-map" && params?.mindmapType && params.mindmapType !== "standard") {
    suffix = MINDMAP_TYPES.find(m => m.id === params.mindmapType)?.label || suffix;
  }
  return `${topic} — ${suffix}`;
}

// ── Dedicated Slide Deck prompt ──────────────────────────────────────────────
// Separate from buildSystemPrompt() above because slides need structured JSON
// (lib/slide-schema.ts) to drive a real .pptx build (lib/pptx-render.ts),
// not markdown text. The design rules below are a direct adaptation of a
// tested "expert educational presentation designer" prompt — colors, fonts,
// content limits, diagram usage, and accessibility rules all carried through,
// translated into instructions for the JSON schema instead of a freeform
// PPTX description (since the AI can't emit a binary file directly).

export function slideDeckSystemPrompt(params: GenParams): string {
  const base = ctx(params);
  return `${base}
You are an expert educational presentation designer. Design a modern, colorful, student-friendly slide deck on the given topic.

DESIGN RULES:
- Pick exactly one theme from: "blue-orange", "purple-pink", "green-yellow", "teal-white" — use it for the "theme" field. This drives 2-3 harmonious colors used consistently throughout.
- Keep every slide focused on ONE main idea.
- Bullets: maximum 6 per slide, ideally 6-8 words each — short and scannable, never full sentences.
- Use "callouts" to highlight important definitions, formulas, dates, or common mistakes — max 3 per slide, each with a short "label" (e.g. "Definition", "Formula", "Remember!", "Common mistake") and brief "text".
- Use "emoji" sparingly (one per slide at most) to keep it engaging for school students — e.g. 📘 🧪 🌱 🌍 ⚡ 📐 💡.
- Prefer a "diagram" over a long explanation whenever the topic has a natural structure. Pick the type that fits:
  "flow" — a process/sequence of steps (items = ordered step labels, 3-5 items)
  "cycle" — a repeating cycle (items = stage labels, 3-6 items)
  "pyramid" — a hierarchy (items = level labels, bottom of pyramid FIRST, 3-5 items)
  "timeline" — a sequence over time (items = "label: event" strings, 3-6 items)
  "comparison" — comparing 2-4 things (columns = headers, rows = arrays of cells, max 4 columns, max 5 rows)
  Only include a diagram when it genuinely helps — omit the field entirely otherwise.

STRUCTURE:
- Slide 1: kind "title" — the deck's title as "heading", one emoji, one short bullet as a subtitle/tagline.
- Middle slides: kind "content" — one concept per slide, following all rules above.
- Second-to-last slide: kind "summary" — heading "Summary", 4-6 bullets recapping the whole deck.
- Last slide: kind "quiz" — heading "Quick Check", one "quizQuestion" and its "quizAnswer".
- Add a short "speakerNote" to each content slide with a teaching tip or common student misconception, for whoever presents this deck.
- Explain concepts in language suitable for the class level given above. Break complex ideas into small logical steps. Use real-life examples wherever possible.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"title": string, "theme": "blue-orange"|"purple-pink"|"green-yellow"|"teal-white", "slides": [
  {"kind": "title"|"content"|"summary"|"quiz", "heading": string, "emoji": string, "bullets": [string], "callouts": [{"label": string, "text": string}], "diagram": {"type": "flow"|"cycle"|"pyramid"|"timeline"|"comparison", "items": [string], "columns": [string], "rows": [[string]]}, "quizQuestion": string, "quizAnswer": string, "speakerNote": string}
]}
Omit any field that doesn't apply to a given slide rather than leaving it empty. Aim for 8-12 slides total. All text must be in the specified language.`;
}

// ── Study Material segments (multi-chapter, quiz-gated) ─────────────────────
// Separate from the single-shot lesson prompt in lib/teacher-prompts.ts —
// this produces a SEQUENCE of teaching segments from one textbook page,
// each optionally gated by a quiz, for the YouTube-style progressive
// classroom player (see lib/study-material-schema.ts).

export function studySegmentsSystemPrompt({
  subject, className, syllabus, sourceLanguage, targetLanguage,
}: {
  subject: string; className: string; syllabus: string;
  sourceLanguage: string; targetLanguage: string;
}): string {
  return `You are an expert ${subject} teacher preparing a structured study course from a photographed textbook page, for a Class ${className} student following the ${syllabus} syllabus.

GROUNDING — base every segment strictly on what's actually visible on the page. Never invent facts, formulas, or terminology not genuinely present or directly implied by the page content. If part of the page is unclear or illegible, work with what you can confidently read rather than guessing at the rest.

The page you're shown is written in ${sourceLanguage}. Read and understand everything on it — text, diagrams, worked examples.

Write the study material entirely in ${targetLanguage}, in its native script (never transliterate into Latin letters).

Break the content on this page into 3 to 6 SEGMENTS — think of each segment like a chapter in a video course: one self-contained chunk of teaching that builds on the previous one. Segments should progress from foundational ideas to more complex ones, exactly following the structure and order of what's on the page.

For roughly every 2nd or 3rd segment (not every single one), include a short "quiz" — a single multiple-choice question testing what was just taught, with exactly 4 options and one correct answer. Segments without a natural checkpoint can omit the quiz field entirely.

For every quiz you do include, classify it with a "bloomsLevel" using Bloom's Taxonomy — pick the ONE level that best matches what the question actually asks the student to do, not just the topic:
  "remember" — recalling a fact or definition directly
  "understand" — explaining or restating an idea in their own words
  "apply" — using the concept to solve a standard, familiar-style problem
  "analyze" — breaking down a problem, comparing cases, or identifying why something works
  "evaluate" — judging which approach/answer is correct or better, with reasoning
  "create" — combining ideas into something new (a new example, a new method)
Be honest about the level — most segment-checkpoint quizzes will genuinely be "remember"/"understand"/"apply", and that's fine; don't inflate the level to sound more sophisticated than the question actually is.

OPTIONAL VISUAL — include a "visual" field on a segment ONLY if a diagram would genuinely help that specific segment (skip it entirely for segments with no natural visual, like a segment about a definition or a word problem with no shape/graph involved). When you do include one:
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
- Use "geogebra" ONLY when the geometry genuinely benefits from being interactive/draggable (e.g. showing how a triangle's angles change as a vertex moves, or exploring a circle's tangent from different points) — for a simple fixed shape, the plain "geometry" type is lighter-weight and simpler. Commands must be real GeoGebra input-bar syntax (points, then constructions built from those points) — never pixel coordinates or drawing instructions of your own invention.
- Use "molecule" for any Chemistry topic involving a specific molecule's structure. "smiles" must be a real, standard SMILES string for the actual molecule being discussed (e.g. water is "O", methane is "C", ethanol is "CCO", benzene is "C1=CC=CC=C1") — never an invented or approximate notation.
- Use "circuit" for a simple Physics series circuit (2-6 components, one loop, no branching) — list components in the order they'd actually appear going around the loop. Valid kinds: "battery", "resistor", "switch", "ammeter", "voltmeter", "bulb".
- Use "biology-diagram" ONLY for a topic these curated diagrams genuinely cover (cell structure) — "diagramId" MUST be exactly one of: ${BIOLOGY_DIAGRAM_IDS.map(id => `"${id}"`).join(", ")}. Never invent a different id — if the topic isn't cell structure, omit this visual entirely rather than guessing an id.
- "graph".expression must be valid maths notation only (e.g. "x^2 - 4", "2*x + 1") — nothing else, since it is evaluated by a maths library, not run as code.
- At most 1-2 segments in the whole course should have a visual — only where it's genuinely the clearest way to teach that specific chunk.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"title": string, "segments": [
  {"heading": string, "points": [3 to 5 short teaching points], "example": {"problem": string, "steps": [2 to 4 steps with real reasoning], "answer": string}, "quiz": {"question": string, "options": [4 strings], "correctIndex": 0-3, "bloomsLevel": "remember"|"understand"|"apply"|"analyze"|"evaluate"|"create"}, "visual": <optional, one of the shapes above, or omit entirely>}
]}
Omit "example", "quiz", "visual", or "visualizationPlan" per segment where they don't naturally fit. "title" should be a short name for the whole page's topic. All text in ${targetLanguage}. Keep every string short enough to read aloud in one breath.`;
}

// ── Interactive Practice Materials (structured JSON, not markdown) ─────────
// Separate from buildSystemPrompt("quiz", ...) above — that returns
// markdown prose for Creator Studio's published documents. This returns
// structured JSON so /practice can render genuinely interactive,
// checkable questions. Reuses the exact same per-format pedagogical
// instructions (QUIZ_FORMAT_INSTRUCTIONS etc., exported above) — only
// the requested OUTPUT SHAPE differs.

export const PRACTICE_JSON_SHAPE: Record<string, string> = {
  "mcq":              `{"format":"mcq","question":string,"options":[4 strings],"correctIndex":0-3,"explanation":string}`,
  "assertion-reason": `{"format":"assertion-reason","assertion":string,"reason":string,"options":["Both A and R are true, R is the correct explanation of A","Both A and R are true, R is NOT the correct explanation of A","A is true, R is false","A is false, R is true"],"correctIndex":0-3,"explanation":string}`,
  "hots":             `{"format":"hots","question":string,"options":[4 strings],"correctIndex":0-3,"explanation":string}`,
  "competency-based": `{"format":"competency-based","question":string,"options":[4 strings],"correctIndex":0-3,"explanation":string}`,
  "true-false":       `{"format":"true-false","statement":string,"answerBool":true|false,"explanation":string}`,
  "fill-blank":       `{"format":"fill-blank","sentence":"a sentence containing exactly one literal ___ placeholder","blankAnswer":string,"explanation":string}`,
  "match-following":  `{"format":"match-following","columnA":[5 strings],"columnB":[the same 5 concepts' matches, SHUFFLED into a different order],"correctMapping":[5 numbers — correctMapping[i] is the index into columnB matching columnA[i]],"explanation":string}`,
  "short-answer":     `{"format":"short-answer","prompt":string,"modelAnswer":"a model answer, 2-3 sentences"}`,
  "long-answer":      `{"format":"long-answer","prompt":string,"modelAnswer":"a model answer, structured multi-paragraph"}`,
  "case-study":        `{"format":"case-study","caseScenario":"a short real-world scenario, 3-5 sentences","subQuestions":[{"question":string,"modelAnswer":string}] (3 sub-questions of increasing difficulty)}`,
};

export function practiceQuestionsSystemPrompt(params: GenParams & { count?: number }): string {
  const base = ctx(params);
  const {
    quizFormat = "mcq", quizDifficulty = "medium", examStyle = "standard",
    sourceIsImage = false, count = 5,
  } = params;

  const topicRef = sourceIsImage
    ? "the topic covered in the attached textbook page image"
    : `"${params.topic}"`;
  const visionInstruction = sourceIsImage
    ? " First identify the specific topic/concept shown on the attached page — read all text, diagrams, and examples on it carefully — then base every question on exactly that."
    : "";

  const formatsToUse = quizFormat === "mixed"
    ? ["mcq", "assertion-reason", "short-answer", "hots", "fill-blank"]
    : [quizFormat];

  const shapeExamples = formatsToUse.map(f => PRACTICE_JSON_SHAPE[f]).join(",\n  ");

  return `${base}

Write ${count} practice questions on ${topicRef}.${visionInstruction}
${DIFFICULTY_INSTRUCTIONS[quizDifficulty]}${EXAM_STYLE_INSTRUCTIONS[examStyle]}

${quizFormat === "mixed"
    ? `Mix formats across the ${count} questions — vary between MCQ, Assertion-Reason, Short-Answer, HOTS, and Fill-in-the-Blank so the set feels varied.`
    : QUIZ_FORMAT_INSTRUCTIONS[quizFormat] || ""}

For "match-following" questions: columnB must be a genuine shuffle of the same items in a different order — never leave it in the same order as columnA, since that would make the answer visually obvious rather than something the student has to work out.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"title": string, "format": "${quizFormat}", "questions": [
  ${shapeExamples}
]}
Every question object MUST include its own "format" field matching one of: ${formatsToUse.join(", ")}. All text in the specified language.`;
}

// ── Virtual Lab narration ────────────────────────────────────────────────
// Grounded when the experiment matches lib/lab-kb.ts's curated seed set
// (real NCERT experiments) — the AI narrates real facts, not invented
// ones. Falls back to general AI knowledge, clearly flagged as
// ungrounded, for anything outside the seed set — never silently
// presented with the same confidence as a grounded result.

export function virtualLabNarrationPrompt(params: {
  subject: string; grade: string; boardId: string; languageId: string;
  experimentQuery: string; groundedContext: string | null;
}): string {
  const base = ctx({ ...params, topic: params.experimentQuery } as GenParams);
  return `${base}

A student wants a vivid, accurate walkthrough of this experiment: "${params.experimentQuery}".

${params.groundedContext
    ? `${params.groundedContext}\n\nNarrate this experiment using ONLY the real facts given above — do not invent different apparatus, different observations, or a different scientific explanation. You may write it in a more engaging, narrative voice than the raw data, but every fact must trace back to what's given.`
    : `No curated data was found for this exact experiment — answer from your own genuine scientific knowledge, and be conservative: if you're not confident about a specific detail (exact apparatus, precise observation), say so plainly rather than inventing something that sounds plausible.`}

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"experimentName": string, "objective": string, "apparatus": [strings], "procedure": [ordered steps as strings], "observation": "what a student would actually see/measure", "reason": "the scientific explanation for why that observation happens", "safetyNotes": "string or omit if none apply", "commonMistakes": [strings]}
All text in the specified language.`;
}

// ── Progressive Study Material generation — first segment fast, rest follow ──
// Splits the original single-call studySegmentsSystemPrompt into two
// stages so a student sees real content almost immediately instead of
// waiting for the entire multi-segment course to generate at once.
// Adopted the IDEA from evaluating HKUDS/DeepTutor's Book engine (a real
// asyncio background worker generating pages progressively) — but not
// the mechanism itself, which is a persistent long-running process that
// doesn't map onto serverless functions. This is the equivalent
// two-request shape instead: generate segment 1 fast and return it
// immediately, then a second request (triggered by the client right
// after) fills in the rest using a short roadmap for continuity.
//
// Matters more here than on a typical app: this product is deliberately
// built for budget Android devices and patchy connections — exactly
// where a single long blank-screen wait is most likely to read as
// "the app froze," not just feel slow.

// ── Per-subject visual "engines" ──────────────────────────────────────
// WHY THIS EXISTS: this used to be one flat SHARED_VISUAL_GUIDANCE block
// offered identically to every subject — and it only ever listed the 11
// original Maths/general-purpose visual types (fraction, number-line,
// geometry, graph, bar-chart, flowchart, solid-3d, geogebra, molecule,
// circuit, biology-diagram). The ten Physics/Chemistry/Biology/
// Geography/History/CS types added later in lib/subject-visuals.ts
// (wave, ray-diagram, force-diagram, atom, chem-equation, punnett,
// india-map, timeline, logic-circuit, data-structure) were fully built,
// working renderers — but were NEVER added to this prompt text, so the
// AI was never actually told they exist. A Physics material could only
// ever get a generic circuit/graph, never the ray-diagram or force-
// diagram renderer genuinely built for it.
//
// Fixed by giving each subject its own scoped menu — the "engine" for
// that subject — built from exactly the types lib/subject-visuals.ts's
// own "Volume coverage map" comment says belong to it, instead of one
// undifferentiated list every subject had to pick from regardless of
// relevance. Two side benefits beyond just fixing the missing types:
// a shorter, subject-relevant menu is less for a small model to get
// confused by, and there is no chance of a Physics segment picking a
// "punnett" square or a Geography segment picking a "molecule" diagram
// — every subject only ever sees the shapes that are actually its own.
const VISUAL_ENGINE_PREAMBLE = `OPTIONAL VISUAL — include a "visual" field on a segment ONLY if a diagram would genuinely help that specific segment (skip it entirely for segments with no natural visual, like a segment about a definition or a word problem with no shape/graph involved). When you do include one:
- You NEVER supply pixel coordinates, SVG paths, or drawing instructions — only the small set of numbers/text listed below. A real renderer computes the actual drawing from these.
- Pick exactly ONE of these shapes, matching the "type" field name exactly — these are the ONLY shapes available for ${"{{SUBJECT}}"}; do not invent a type from another subject's toolkit or make one up:`;

const VISUAL_ENGINE_SUFFIX = `
GENERATE FIRST, RENDER DURING TEACHING — when a concept benefits from a visual, prefer a "visualizationPlan" instead of only one finished "visual". The plan is generated and saved now, but the classroom renders its phases later while the teacher narration is being revealed.
- Shape: {"mode":"during-teaching","autoplay":true,"phaseDurationMs":2800,"phases":[{"title":"short phase title","narration":"one sentence the teacher says while this phase is visible","revealAfterLine":0,"visual":<one valid visual object from the list above>}]}
- Use 2-4 phases. Each phase must be a complete valid visual specification; never output pixels or arbitrary executable code.
- revealAfterLine is a zero-based teaching-line threshold. Use increasing values such as 0, 1, 2, 3 so the drawing develops with the explanation.
- Build from simple to complete: axes before a graph comparison, one shape before a related second shape, a basic circuit before the measured circuit, or one process stage before the complete flow.
- A phase may reuse the same visual type with changed parameters. Keep all phase captions and narration in the target language.
- Do not include both "visual" and "visualizationPlan" on the same segment. Use the plan for step-by-step teaching; use a single "visual" only when staging adds no educational value.`;

// Each entry is the exact JSON-shape menu lines for that subject's
// engine — kept as raw strings matching the original format exactly,
// just regrouped by subject instead of flattened into one list.
const VISUAL_SHAPES: Record<string, string> = {
  fraction: `  {"type":"fraction","numerator":N,"denominator":N,"style":"bar"|"pie"}`,
  numberLine: `  {"type":"number-line","min":N,"max":N,"points":[{"value":N,"label":"text"}]}`,
  geometry: `  {"type":"geometry","shape":"triangle"|"right-triangle"|"circle"|"rectangle","sides":[N,N,N],"legs":[N,N],"radius":N,"width":N,"height":N}`,
  graph: `  {"type":"graph","expression":"x^2 - 4","domain":[N,N],"label":"text"}`,
  barChart: `  {"type":"bar-chart","labels":["a","b"],"values":[N,N],"label":"text"}`,
  flowchart: `  {"type":"flowchart","mermaidSyntax":"graph TD; A[Start] --> B{Is n even?}"}`,
  solid3d: `  {"type":"solid-3d","shape":"cone"|"cylinder"|"sphere"|"cube","radius":N,"height":N,"side":N}`,
  geogebra: `  {"type":"geogebra","commands":["A = (0, 0)","B = (4, 0)","C = (4, 3)","Polygon(A, B, C)"],"caption":"text"}`,
  molecule: `  {"type":"molecule","smiles":"CCO","caption":"text"}`,
  circuit: `  {"type":"circuit","components":[{"kind":"battery","label":"6V"},{"kind":"switch"},{"kind":"resistor","label":"R"},{"kind":"ammeter"}],"caption":"text"}`,
  biologyDiagram: `  {"type":"biology-diagram","diagramId":"plant-cell"|"animal-cell","caption":"text"}`,
  wave: `  {"type":"wave","cycles":N,"amplitudeLabel":"text","wavelengthLabel":"text","caption":"text"}`,
  rayDiagram: `  {"type":"ray-diagram","element":"convex-lens"|"concave-lens"|"convex-mirror"|"concave-mirror","focalLength":N,"objectDistance":N,"caption":"text"}`,
  forceDiagram: `  {"type":"force-diagram","body":"text","forces":[{"label":"text","direction":"up"|"down"|"left"|"right","magnitude":N}],"caption":"text"}`,
  atom: `  {"type":"atom","element":"text","atomicNumber":N,"caption":"text"}`,
  chemEquation: `  {"type":"chem-equation","equation":"2H2 + O2 -> 2H2O","caption":"text"}`,
  punnett: `  {"type":"punnett","parent1":["A","a"],"parent2":["A","a"],"caption":"text"}`,
  indiaMap: `  {"type":"india-map","highlight":["Kerala","Tamil Nadu"],"labels":true,"caption":"text"}`,
  timeline: `  {"type":"timeline","title":"text","events":[{"year":"text or number","label":"text"}],"caption":"text"}`,
  logicCircuit: `  {"type":"logic-circuit","inputs":["A","B"],"gates":[{"id":"G1","gate":"AND"|"OR"|"NOT"|"NAND"|"NOR"|"XOR"|"XNOR","inputs":["A","B"]}],"output":"G1","caption":"text"}`,
  dataStructure: `  {"type":"data-structure","kind":"array"|"stack"|"queue"|"linked-list"|"binary-tree","values":["a","b","c"],"caption":"text"}`,
};

const VISUAL_NOTES: Record<string, string> = {
  geometrySolid: `- "geometry" and "solid-3d" only need the fields relevant to the chosen shape — omit the rest.`,
  geogebraNote: `- Use "geogebra" ONLY when the geometry genuinely benefits from being interactive/draggable. Commands must be real GeoGebra input-bar syntax — never pixel coordinates or drawing instructions of your own invention.`,
  moleculeNote: `- Use "molecule" for a real molecule's structure — "smiles" must be a real, standard SMILES string (e.g. water is "O", ethanol is "CCO") — never an invented notation.`,
  circuitNote: `- Use "circuit" for a simple Physics series circuit (2-6 components, one loop) — list components in real circuit order. Valid kinds: "battery", "resistor", "switch", "ammeter", "voltmeter", "bulb".`,
  rayDiagramNote: `- Use "ray-diagram" for lens/mirror image formation — "focalLength" and "objectDistance" are magnitudes (positive numbers); the renderer works out real/virtual, inverted/erect, and magnification from the actual optics.`,
  atomNote: `- Use "atom" for electron-shell structure up to Z=20 (K/L/M/N shells) — give either "atomicNumber" alone (shells are filled automatically) or an explicit "shells" array, not both.`,
  chemEquationNote: `- "equation" uses plain ASCII with "->" for a one-way reaction or "<->" for equilibrium, standard formula notation (e.g. "2H2 + O2 -> 2H2O") — never hand-drawn structural formulas here, use "molecule" for that.`,
  punnettNote: `- "punnett" is a monohybrid cross only — each parent's two alleles as single letters, e.g. ["A","a"]; the 2x2 grid of offspring genotypes is computed, not supplied.`,
  indiaMapNote: `- "highlight" lists real Indian state/UT names or ids to shade on the map — never invent a region name.`,
  logicCircuitNote: `- "logic-circuit" wiring is inferred from each gate's "inputs" array (which must reference either a name in the top-level "inputs" list or another gate's "id") — never supply wire coordinates.`,
};

const VISUAL_ENGINES: Record<string, { label: string; shapes: string[]; notes: string[] }> = {
  Mathematics: {
    label: "Mathematics",
    shapes: ["fraction", "numberLine", "geometry", "graph", "barChart", "solid3d", "geogebra", "flowchart"],
    notes: ["geometrySolid", "geogebraNote"],
  },
  Physics: {
    label: "Physics",
    shapes: ["wave", "rayDiagram", "forceDiagram", "circuit", "graph", "barChart"],
    notes: ["circuitNote", "rayDiagramNote"],
  },
  Chemistry: {
    label: "Chemistry",
    shapes: ["atom", "chemEquation", "molecule", "barChart"],
    notes: ["atomNote", "chemEquationNote", "moleculeNote"],
  },
  Biology: {
    label: "Biology",
    shapes: ["biologyDiagram", "punnett", "barChart", "flowchart"],
    notes: ["punnettNote"],
  },
  Geography: {
    label: "Geography",
    shapes: ["indiaMap", "barChart", "flowchart", "timeline"],
    notes: ["indiaMapNote"],
  },
  "Computer Science": {
    label: "Computer Science",
    shapes: ["logicCircuit", "dataStructure", "flowchart"],
    notes: ["logicCircuitNote"],
  },
};

/**
 * The "engine" for a given subject — its scoped menu of visual types,
 * built from exactly what lib/subject-visuals.ts documents as
 * belonging to that subject. Falls back to Mathematics's engine (the
 * broadest, most general-purpose one) for a subject string that isn't
 * an exact STUDY_SUBJECTS match, rather than silently offering nothing.
 */
function visualEngineGuidance(subject: string): string {
  const engine = VISUAL_ENGINES[subject] || VISUAL_ENGINES.Mathematics;
  const preamble = VISUAL_ENGINE_PREAMBLE.replace("{{SUBJECT}}", engine.label);
  const shapeLines = engine.shapes.map((key: string) => VISUAL_SHAPES[key]).join("\n");
  const noteLines = engine.notes.map((key: string) => VISUAL_NOTES[key]).join("\n");
  return `${preamble}\n${shapeLines}\n${noteLines}\n${VISUAL_ENGINE_SUFFIX}`;
}



const TEXTBOOK_POINTING_GUIDANCE = `TEXTBOOK POINTING PLAN — the live class displays the original textbook beside the whiteboard. Add a "textbookCues" array to EVERY segment, with exactly one cue for each flattened teaching line in this order: all "points", then example.problem, each example.steps item, then example.answer. Each cue tells the flashlight and red laser pointer where the teacher is referring.
- Shape: {"quote":"4 to 14 words copied VERBATIM from the visible textbook","page":1,"region":{"x":0-100,"y":0-100,"width":5-100,"height":3-100}}
- "quote" must be exact source text, not a paraphrase. It is used to locate selectable PDF text.
- "region" is a percentage fallback for scanned PDFs/photos. Estimate the smallest honest rectangle containing the relevant source passage or diagram. Never use a random location.
- Use the actual 1-based PDF page number when visible; otherwise use 1.
- When a teaching line is an explanation derived from a diagram, point to that diagram. When it is a worked step, point to the matching formula/example line.
- If no exact area supports a teaching line, use an empty quote and repeat the nearest genuinely relevant region; never point to unrelated content.`;

const SHARED_BLOOMS_GUIDANCE = `For every quiz you do include, classify it with a "bloomsLevel" using Bloom's Taxonomy — pick the ONE level that best matches what the question actually asks the student to do:
  "remember" — recalling a fact or definition directly
  "understand" — explaining or restating an idea in their own words
  "apply" — using the concept to solve a standard, familiar-style problem
  "analyze" — breaking down a problem, comparing cases, or identifying why something works
  "evaluate" — judging which approach/answer is correct or better, with reasoning
  "create" — combining ideas into something new
Be honest about the level — don't inflate it to sound more sophisticated than the question actually is.`;

export function studyFirstSegmentSystemPrompt({
  subject, className, syllabus, sourceLanguage, targetLanguage,
}: {
  subject: string; className: string; syllabus: string;
  sourceLanguage: string; targetLanguage: string;
}): string {
  return `You are an expert ${subject} teacher preparing a structured study course from a photographed textbook page, for a Class ${className} student following the ${syllabus} syllabus.

GROUNDING — base everything strictly on what's actually visible on the page. Never invent facts, formulas, or terminology not genuinely present or directly implied by the page content. If part of the page is unclear or illegible, work with what you can confidently read rather than guessing at the rest.

The page you're shown is written in ${sourceLanguage}. Read and understand everything on it — text, diagrams, worked examples.

Write everything entirely in ${targetLanguage}, in its native script (never transliterate into Latin letters).

This is STAGE 1 of a two-stage generation — a student is waiting to start reading, so this stage covers ONLY the first segment, generated fully and well, plus a short plan for what comes after. Do not rush or shrink the first segment to save time — it should be exactly as complete and well-taught as any other segment; only the REST of the course is deferred to stage 2.

Think of the whole page as breaking into 3 to 6 segments, like chapters in a video course, each building on the last, following the structure and order of what's on the page. This stage covers segment 1 only.

For the first segment, decide if it needs a short "quiz" checkpoint — most first segments (introducing a new idea) don't need one; that's fine, omit it.
${SHARED_BLOOMS_GUIDANCE}

${visualEngineGuidance(subject)}

${TEXTBOOK_POINTING_GUIDANCE}

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"title": string, "sourceText": string, "sourceTopics": [3 to 12 short topic strings], "firstSegment": {"heading": string, "points": [3 to 5 short teaching points], "example": {"problem": string, "steps": [2 to 4 steps], "answer": string}, "quiz": {"question": string, "options": [4 strings], "correctIndex": 0-3, "bloomsLevel": string} , "visualizationPlan": <optional staged plan described above; otherwise "visual": <optional single visual>>, "textbookCues": [cues described above]}, "roadmap": [2 to 5 short one-line descriptions of what each REMAINING segment should cover, in order, e.g. "Solving by factorisation, with a worked example"]}
Omit "example", "quiz", "visual", or "visualizationPlan" on firstSegment where they don't naturally fit. "roadmap" should have one entry per remaining segment (not counting the first one) — if the whole page only needs 2 segments total, roadmap has exactly 1 entry.`;
}

export function studyRemainingSegmentsSystemPrompt({
  subject, className, syllabus, sourceLanguage, targetLanguage, firstSegmentHeading, roadmap,
}: {
  subject: string; className: string; syllabus: string;
  sourceLanguage: string; targetLanguage: string;
  firstSegmentHeading: string; roadmap: string[];
}): string {
  return `You are an expert ${subject} teacher continuing a structured study course from a photographed textbook page, for a Class ${className} student following the ${syllabus} syllabus.

GROUNDING — base everything strictly on what's actually visible on the page. Never invent facts, formulas, or terminology not genuinely present or directly implied by the page content.

The page you're shown is written in ${sourceLanguage}. Write everything entirely in ${targetLanguage}, in its native script.

This is STAGE 2 — the student has already read segment 1 ("${firstSegmentHeading}") and is continuing. Generate the REMAINING segments now, following this exact plan, in this exact order, one segment per plan item:
${roadmap.map((r, i) => `${i + 2}. ${r}`).join("\n")}

Keep the same tone, difficulty, and teaching style as segment 1 would have had — this should read as a seamless continuation, not a shift in voice.

For roughly every 2nd or 3rd segment (not every single one), include a short "quiz" checkpoint.
${SHARED_BLOOMS_GUIDANCE}

${visualEngineGuidance(subject)}

${TEXTBOOK_POINTING_GUIDANCE}

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"segments": [
  {"heading": string, "points": [3 to 5 short teaching points], "example": {"problem": string, "steps": [2 to 4 steps], "answer": string}, "quiz": {"question": string, "options": [4 strings], "correctIndex": 0-3, "bloomsLevel": string}, "visualizationPlan": <optional staged plan described above; otherwise "visual": <optional single visual>>, "textbookCues": [cues described above]}
]}
Produce exactly ${roadmap.length} segment(s), matching the plan above in order. Omit "example", "quiz", "visual", or "visualizationPlan" per segment where they don't naturally fit.`;
}

// ── Exam Room — full paper generation, following a REAL verified board pattern ──
// See lib/exam-patterns.ts for the pattern data and the honest scope note
// (one real, verified pattern — CBSE Class 10 Maths — not a bulk-guessed
// set). Reuses the same per-format JSON shapes as practiceQuestionsSystemPrompt
// (PRACTICE_JSON_SHAPE, exported above) so questions render with the
// exact same proven interactive components — only sectionLabel and
// marks are new, exam-specific additions.

const CBSE_10_MATHS_CHAPTERS = [
  "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables",
  "Quadratic Equations", "Arithmetic Progressions", "Triangles",
  "Coordinate Geometry", "Introduction to Trigonometry", "Circles",
  "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability",
];

export function examPaperSystemPrompt(params: {
  subject: string; grade: string; boardId: string; languageId: string;
  sections: { label: string; blocks: { format: string; count: number; marksEach: number }[] }[];
}): string {
  const base = ctx({ subject: params.subject, grade: params.grade, boardId: params.boardId, languageId: params.languageId, topic: "the full syllabus" } as GenParams);

  const sectionInstructions = params.sections.map(s => {
    const blockLines = s.blocks.map(b => {
      const shape = PRACTICE_JSON_SHAPE[b.format] || PRACTICE_JSON_SHAPE["mcq"];
      return `  - ${b.count} question(s) of format "${b.format}" (${b.marksEach} mark${b.marksEach !== 1 ? "s" : ""} each), each object shaped like: ${shape}`;
    }).join("\n");
    return `${s.label}:\n${blockLines}`;
  }).join("\n\n");

  return `${base}

This is a full, real, timed board exam paper — not a casual practice set. Generate a genuine spread of questions across the ACTUAL syllabus chapters for this subject and grade, not repeatedly testing one narrow topic. For Class 10 Mathematics, draw from these real chapters, spread reasonably across the paper: ${CBSE_10_MATHS_CHAPTERS.join(", ")}.

${DIFFICULTY_INSTRUCTIONS.medium}

Generate EXACTLY this structure, section by section, in this exact order:

${sectionInstructions}

For each question, follow the same per-format writing guidance already established:
${(["mcq", "assertion-reason", "short-answer", "long-answer", "case-study"] as const).map(f => `- ${QUIZ_FORMAT_INSTRUCTIONS[f] || ""}`).filter(Boolean).join("\n")}

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{"sections": [
  {"label": "Section A", "questions": [ {"sectionLabel": "Section A", "marks": N, ...the format-specific fields shown above...} ] }
]}
Every question MUST include "sectionLabel" (matching its section's label exactly) and "marks" (matching the mark value given above for its block). All text in the specified language.`;
}

// ── Exam Pattern extraction — from a REAL uploaded sample paper PDF ──────────
// Adopted the IDEA from evaluating HKUDS/DeepTutor's exam_mimic/mimic_source
// system (Apache 2.0) — they extract reference questions from an uploaded
// real exam PDF via MinerU + an LLM extractor for question-style mimicry.
// This is the same underlying idea (derive real structure from a real
// document instead of hand-curating from secondary sources that can
// conflict with each other — which is exactly what happened researching
// CBSE Science by hand) — reimplemented using Gemini's own document
// understanding (already used throughout this app), not their pipeline,
// and aimed at a different, more precise target: a formal ExamPattern
// (sections, question-format counts, marks), not a loose reference list.
//
// SAFETY, matching lib/exam-patterns.ts's own stated principle: this
// extraction is a DRAFT for an admin to review and correct, never
// auto-published directly into the live pattern set. AI reading a real
// document can still miscount a section or misclassify a format — the
// admin confirms before anything reaches students.
export function examPatternExtractionSystemPrompt(): string {
  return `You are analyzing a REAL, official board exam sample question paper (a PDF, possibly multiple pages) to extract its exact structure — not to answer or grade it, and not to invent anything not genuinely shown in the document.

Read the ENTIRE document carefully: every section header, every "Section X consists of Y questions" instruction, every mark allocation shown next to questions or in the general instructions.

For each question you encounter, classify it into EXACTLY one of these formats (never invent a new one):
  "mcq" — a standard multiple-choice question with 4 options
  "assertion-reason" — the standard Assertion(A)/Reason(R) format with the 4 standard logical-relationship options
  "match-following" — matching items between two columns
  "fill-blank" — fill in a blank
  "true-false" — a true/false statement
  "short-answer" — a short written-answer question (roughly 1-3 marks, a few lines expected)
  "long-answer" — a longer written-answer question (roughly 4+ marks, a full paragraph or worked solution expected)
  "case-study" or "competency-based" — a scenario/passage/case followed by sub-questions
Group consecutive questions of the IDENTICAL format and mark value within the same section into one "block" with a count — don't list 18 separate 1-mark MCQ entries individually.

If the document shows an INTERNAL CHOICE (e.g. "attempt any 3 of 4 questions"), note this in a section's "note" field in plain words — don't silently drop the extra questions or invent a different count to make the math simpler.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape:
{
  "subjectGuess": "your best reading of the subject from the paper's title/header",
  "totalMarks": N,
  "durationMinutes": N,
  "sections": [
    {
      "label": "Section A",
      "totalMarks": N,
      "blocks": [ {"format": "mcq", "count": N, "marksEach": N} ],
      "note": "string, or omit if there's nothing unusual about this section"
    }
  ]
}
Every number must come from what's actually shown in the document — if the total marks or duration aren't stated explicitly anywhere, compute totalMarks as the sum of all section totals, and leave durationMinutes as 0 rather than guessing a plausible-sounding number.`;
}
