/**
 * Curated REAL board exam patterns — Exam Room always follows an actual
 * verified pattern, never an approximated or invented one. A fake
 * blueprint would defeat the entire point of simulating a real exam.
 *
 * Verified directly (web search, current 2026 sources, cross-checked
 * across multiple independent references, not a single source): CBSE
 * Class 10 Mathematics theory paper — 80 marks, 3 hours, 38 compulsory
 * questions across 5 sections. This exact structure has been stable for
 * several years under CBSE's competency-based reform.
 *
 * Seed set only — one pattern, deliberately, same honest scope as
 * lib/concept-kb.ts / lib/lab-kb.ts. Every other subject/class/board
 * combination needs the same real verification before being added —
 * this is genuine, ongoing curation work, not something to bulk-fill
 * with guessed structures.
 */
import type { QuizFormat } from "./content-generators";

export interface ExamBlock {
  format:     QuizFormat;
  count:      number;
  marksEach:  number;
}

export interface ExamSection {
  label:      string;   // "Section A"
  totalMarks: number;
  blocks:     ExamBlock[];
  note?:      string;
}

export interface ExamPattern {
  id:              string;
  board:           string;   // "cbse"
  grade:           string;
  subject:         string;
  totalMarks:      number;
  durationMinutes: number;
  sections:        ExamSection[];
}

export const EXAM_PATTERNS: ExamPattern[] = [
  {
    id: "cbse-10-maths", board: "cbse", grade: "10", subject: "Mathematics",
    totalMarks: 80, durationMinutes: 180,
    sections: [
      {
        label: "Section A", totalMarks: 20,
        blocks: [
          { format: "mcq", count: 18, marksEach: 1 },
          { format: "assertion-reason", count: 2, marksEach: 1 },
        ],
        note: "No internal choice.",
      },
      {
        label: "Section B", totalMarks: 10,
        blocks: [{ format: "short-answer", count: 5, marksEach: 2 }],
      },
      {
        label: "Section C", totalMarks: 18,
        blocks: [{ format: "short-answer", count: 6, marksEach: 3 }],
      },
      {
        label: "Section D", totalMarks: 20,
        blocks: [{ format: "long-answer", count: 4, marksEach: 5 }],
      },
      {
        label: "Section E", totalMarks: 12,
        blocks: [{ format: "case-study", count: 3, marksEach: 4 }],
      },
    ],
  },
];

export function findExamPattern(board: string, grade: string, subject: string): ExamPattern | null {
  return EXAM_PATTERNS.find(p => p.board === board && p.grade === grade && p.subject === subject) || null;
}

export function totalQuestionCount(pattern: ExamPattern): number {
  return pattern.sections.reduce((sum, s) => sum + s.blocks.reduce((bs, b) => bs + b.count, 0), 0);
}

// ── Extraction from a real uploaded sample paper — see
// content-generators.ts's examPatternExtractionSystemPrompt for the
// full reasoning. A DRAFT shape, not yet a full ExamPattern — missing
// board/grade/id, which the admin supplies after reviewing the extracted
// structure against the real document. Never auto-published directly. ──
export interface ExtractedPatternDraft {
  subjectGuess:    string;
  totalMarks:      number;
  durationMinutes: number;
  sections:        ExamSection[];
}

const VALID_FORMATS = new Set([
  "mcq", "assertion-reason", "match-following", "fill-blank", "true-false",
  "short-answer", "long-answer", "case-study", "competency-based",
]);

export function isValidExtractedPattern(v: any): v is ExtractedPatternDraft {
  if (!v || typeof v.totalMarks !== "number" || !Array.isArray(v.sections) || v.sections.length === 0) return false;
  return v.sections.every((s: any) =>
    s && typeof s.label === "string" && Array.isArray(s.blocks) && s.blocks.length > 0 &&
    s.blocks.every((b: any) => b && VALID_FORMATS.has(b.format) && typeof b.count === "number" && typeof b.marksEach === "number"),
  );
}

/** A real, checkable cross-verification — does the sum of every block's
 *  marks in a section actually match that section's declared total? A
 *  mismatch here means the AI misread something, and the admin should
 *  see it flagged rather than silently trust a wrong number. */
export function findSectionMarksMismatches(pattern: ExtractedPatternDraft | ExamPattern): string[] {
  const issues: string[] = [];
  for (const s of pattern.sections) {
    const computed = s.blocks.reduce((sum, b) => sum + b.count * b.marksEach, 0);
    if (s.totalMarks && computed !== s.totalMarks) {
      issues.push(`${s.label}: blocks sum to ${computed} marks but the section declares ${s.totalMarks}.`);
    }
  }
  const grandTotal = pattern.sections.reduce((sum, s) => sum + s.blocks.reduce((bs, b) => bs + b.count * b.marksEach, 0), 0);
  if (pattern.totalMarks && grandTotal !== pattern.totalMarks) {
    issues.push(`All sections sum to ${grandTotal} marks but the paper declares ${pattern.totalMarks} total.`);
  }
  return issues;
}

/**
 * Shared extraction call — used by both the admin pattern-curation tool
 * AND the student-facing "upload your own paper" flow in Exam Room.
 * One implementation, not two copies, so a fix or prompt improvement
 * lands in both places at once.
 */
export async function extractPatternFromPdf(
  base64: string,
  callGeminiWithImage: (system: string, prompt: string, base64: string, mimeType: "application/pdf") => Promise<string>,
  parseAiJson: (raw: string) => any,
  systemPromptFn: () => string,
): Promise<{ draft: ExtractedPatternDraft | null; mismatches: string[]; error?: string }> {
  const raw = await callGeminiWithImage(systemPromptFn(), "Extract the exam structure from this document.", base64, "application/pdf");
  const parsed = parseAiJson(raw);
  if (!isValidExtractedPattern(parsed)) {
    return { draft: null, mismatches: [], error: "Could not extract a clear structure from this document. Try a clearer scan or a different sample paper." };
  }
  return { draft: parsed, mismatches: findSectionMarksMismatches(parsed) };
}
