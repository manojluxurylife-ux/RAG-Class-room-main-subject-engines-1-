/**
 * Structured, interactive practice questions — genuinely checkable in
 * the browser (select an option, see right/wrong immediately), not just
 * markdown text with an answer key at the bottom. This needed its own
 * JSON-based schema/prompt because the existing quiz generator
 * (lib/content-generators.ts, used by Creator Studio) returns markdown
 * prose — right for a document a teacher publishes, wrong for something
 * a student interacts with question-by-question.
 *
 * Reuses the SAME per-format pedagogical instructions already written
 * for Creator Studio's quiz generator (QUIZ_FORMAT_INSTRUCTIONS etc.,
 * exported from content-generators.ts) rather than duplicating them —
 * only the OUTPUT SHAPE differs (structured JSON here vs. markdown
 * there), not the actual question-writing guidance.
 */

export const PRACTICE_FORMATS = [
  { id: "mcq",              label: "Multiple Choice" },
  { id: "assertion-reason", label: "Assertion–Reason" },
  { id: "match-following",  label: "Match the Following" },
  { id: "fill-blank",       label: "Fill in the Blanks" },
  { id: "true-false",       label: "True / False" },
  { id: "short-answer",     label: "Short Answer" },
  { id: "long-answer",      label: "Long Answer" },
  { id: "hots",             label: "HOTS (Higher Order Thinking)" },
  { id: "case-study",       label: "Case Study" },
  { id: "competency-based", label: "Competency-Based" },
  { id: "mixed",            label: "Mixed" },
] as const;
export type PracticeFormat = typeof PRACTICE_FORMATS[number]["id"];

// Formats with one clear right answer the browser can check immediately.
export const AUTO_CHECKABLE: PracticeFormat[] = [
  "mcq", "assertion-reason", "hots", "competency-based", "true-false", "fill-blank", "match-following",
];
// Formats that are inherently open-ended — self-check against a model
// answer, not auto-graded (no AI-grading of free text built here; a
// real, separate future enhancement, not silently faked as "correct/
// incorrect" when it can't genuinely be judged that way).
export const SELF_CHECK: PracticeFormat[] = ["short-answer", "long-answer", "case-study"];

export interface PracticeQuestion {
  id:       string;
  format:   PracticeFormat;   // the actual format of THIS question — relevant when the set is "mixed"
  // MCQ / Assertion-Reason / HOTS / Competency-based — all rendered the
  // same interactive way, just with different AI-generation depth
  question?:      string;
  options?:       string[];
  correctIndex?:  number;
  // Assertion-Reason specific framing (options[] still holds the 4 standard A/R choices)
  assertion?:     string;
  reason?:        string;
  // Match the Following
  columnA?:       string[];
  columnB?:       string[];        // shuffled — not in the same order as columnA
  correctMapping?:number[];        // correctMapping[i] = index into columnB matching columnA[i]
  // Fill in the Blank
  sentence?:      string;          // contains a literal "___" placeholder
  blankAnswer?:   string;
  // True/False
  statement?:     string;
  answerBool?:    boolean;
  // Short/Long Answer, Case Study — self-check only
  prompt?:        string;
  modelAnswer?:   string;
  caseScenario?:  string;
  subQuestions?:  { question: string; modelAnswer: string }[];
  explanation?:   string;          // shown after checking, any format
}

export interface PracticeSet {
  title:     string;
  format:    PracticeFormat;
  questions: PracticeQuestion[];
}

/** Loose runtime validation before trusting AI-generated JSON. */
export function isValidPracticeSet(v: any): v is PracticeSet {
  if (!v || typeof v.title !== "string" || !Array.isArray(v.questions) || v.questions.length === 0) return false;
  return v.questions.every((q: any) => q && typeof q.format === "string");
}
