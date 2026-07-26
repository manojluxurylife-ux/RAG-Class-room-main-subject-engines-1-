/**
 * Exam Room — a full, timed, sectioned exam paper following a REAL
 * board exam pattern (lib/exam-patterns.ts), not a loose practice set.
 * Genuinely different from Practice Materials: a full paper with real
 * mark weightage across sections, a countdown timer, and a submit-once
 * flow — not per-question immediate feedback.
 *
 * Reuses PracticeQuestion's per-format shape (lib/practice-schema.ts)
 * rather than inventing a new one — the same interactive-question
 * rendering already proven there applies here too, just with marks and
 * a section label attached.
 *
 * HONEST SCORING LIMIT, same principle as Practice Materials: only
 * auto-checkable formats (MCQ, Assertion-Reason — Section A in the
 * CBSE Class 10 Maths pattern, 20 of 80 marks) get a real, objective
 * score on submit. Short-answer, long-answer, and case-study questions
 * (the other 60 marks) are self-assessed — the student sees the model
 * answer and marks their own attempt, contributing a clearly-labeled
 * "estimated" score, never silently merged into the objective one.
 */
import type { PracticeQuestion, PracticeFormat } from "./practice-schema";

export interface ExamQuestion extends PracticeQuestion {
  sectionLabel: string;
  marks: number;
}

export interface ExamPaper {
  patternId: string;
  sections: { label: string; questions: ExamQuestion[] }[];
}

export type SelfMark = "correct" | "partial" | "incorrect";

export interface ExamAttempt {
  id:               string;
  studentId:        string;
  patternId:        string;
  board:            string;
  grade:            string;
  subject:          string;
  totalMarks:       number;
  durationMinutes:  number;
  sections:         { label: string; questions: ExamQuestion[] }[];
  // Auto-checkable answers, keyed by question id — index for MCQ-shaped,
  // string for fill-blank, boolean for true-false, Record<number,number>
  // for match-following. Loose on purpose (mirrors the practice page).
  answers:          Record<string, any>;
  // Free-text the student typed for open-ended questions, keyed by id —
  // kept even though it isn't auto-graded, so their own attempt is still
  // visible next to the model answer during self-assessment.
  writtenAnswers:   Record<string, string>;
  selfMarks:        Record<string, SelfMark>;
  startedAt:        string;
  submittedAt?:     string;
  autoScore?:       number;      // out of the auto-checkable marks only
  autoScoreMax?:    number;
  estimatedScore?:  number;      // autoScore + self-assessed marks, clearly labeled as an estimate
}

export function isValidExamPaper(v: any): v is ExamPaper {
  if (!v || !Array.isArray(v.sections) || v.sections.length === 0) return false;
  return v.sections.every((s: any) =>
    s && typeof s.label === "string" && Array.isArray(s.questions) && s.questions.length > 0 &&
    s.questions.every((q: any) => q && typeof q.format === "string" && typeof q.marks === "number"),
  );
}
