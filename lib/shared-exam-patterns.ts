/**
 * Student-contributed exam patterns — the scalable answer to "we can't
 * hand-curate a verified pattern for every board/class/subject/medium
 * combination." When a student uploads their own real paper and the
 * extraction passes the marks cross-check cleanly, the STRUCTURE (not
 * the generated questions) is shared so the next student in the exact
 * same category doesn't need to re-upload the same kind of paper.
 *
 * DELIBERATELY different from how Study Materials sharing works: Study
 * Materials shares the actual generated CONTENT, because reading the
 * same correct explanation is fine — it's teaching. Sharing the exact
 * same generated EXAM QUESTIONS across students would let them share
 * answers with each other, defeating the point of a test. So only the
 * structure (sections, format/count/marks) is shared — every student
 * who uses it still gets their own freshly-generated set of questions.
 *
 * Matched on board + grade + subject only, not language/medium — the
 * real exam pattern's STRUCTURE doesn't depend on which language it's
 * asked in; only the final generated questions need to be in the
 * requesting student's own language, which already happens at
 * generation time regardless of who contributed the underlying pattern.
 *
 * Auto-published, same as Study Materials, with one real, automated
 * quality gate Study Materials doesn't have an equivalent for: only
 * patterns that pass the marks-consistency check (lib/exam-patterns.ts's
 * findSectionMarksMismatches) are shared at all. A pattern with a real,
 * detected mismatch stays private to the student who uploaded it —
 * sharing an already-flagged-as-possibly-wrong structure to other
 * students would be a worse outcome than not sharing it at all.
 */
import { collectionHelpers } from "./firestore-collection";
import type { ExamSection } from "./exam-patterns";

export interface SharedExamPattern {
  id:              string;
  board:           string;
  grade:           string;
  subject:         string;
  totalMarks:      number;
  durationMinutes: number;
  sections:        ExamSection[];
  contributedBy:   string;   // student id, for moderation if a pattern is ever reported as wrong
  useCount:        number;   // how many other students have generated an exam from this
  createdAt:       string;
}

const col = collectionHelpers<SharedExamPattern>("shared_exam_patterns");

export const sharedExamPatternsStore = {
  byId: col.byId,

  /** Most-used-first — a pattern several students have already
   *  generated real exams from is a small, real trust signal over one
   *  nobody's used yet, even though both passed the same mismatch check. */
  async findMatching(board: string, grade: string, subject: string): Promise<SharedExamPattern[]> {
    const items = await col.where("board", board);
    return items
      .filter(p => p.grade === grade && p.subject.toLowerCase().trim() === subject.toLowerCase().trim())
      .sort((a, b) => b.useCount - a.useCount);
  },

  /**
   * Every shared pattern already available for a student's exact
   * board + grade, across all subjects — this is what makes a
   * previously-uploaded paper genuinely "available to" a matching
   * student, not just discoverable if they happen to type the right
   * subject name. One entry per subject (the most-used pattern, if
   * more than one exists for the same subject), sorted alphabetically
   * so the list is scannable, not just a useCount leaderboard.
   */
  async findAllForClass(board: string, grade: string): Promise<SharedExamPattern[]> {
    const items = await col.where("board", board);
    const forGrade = items.filter(p => p.grade === grade);

    const bestPerSubject = new Map<string, SharedExamPattern>();
    for (const p of forGrade) {
      const key = p.subject.toLowerCase().trim();
      const existing = bestPerSubject.get(key);
      if (!existing || p.useCount > existing.useCount) bestPerSubject.set(key, p);
    }
    return Array.from(bestPerSubject.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  },

  async create(data: Omit<SharedExamPattern, "id" | "useCount" | "createdAt">): Promise<SharedExamPattern> {
    return col.create({ ...data, useCount: 0, createdAt: new Date().toISOString() });
  },

  async incrementUseCount(id: string): Promise<void> {
    const pattern = await col.byId(id);
    if (pattern) await col.update(id, { useCount: pattern.useCount + 1 });
  },
};
