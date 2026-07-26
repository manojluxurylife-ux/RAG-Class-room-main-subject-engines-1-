import { collectionHelpers } from "./firestore-collection";

export type ChapterTestAnswer = {
  question: string;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  bloomsLevel?: string;
};

export type ChapterTestAttempt = {
  id: string;
  studentId: string;
  canonicalStudentId?: string;
  documentId: string;
  textbookTitle: string;
  subject: string;
  chapterId: string;
  chapterTitle: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  answers: ChapterTestAnswer[];
  attemptedAt: string;
};

const col = collectionHelpers<ChapterTestAttempt>("chapter_test_attempts");

export const chapterAssessmentsStore = {
  async record(data: Omit<ChapterTestAttempt, "id" | "attemptedAt">) {
    return col.create({ ...data, attemptedAt: new Date().toISOString() });
  },
  async byStudent(studentId: string) {
    const rows = (await col.all()).filter(row => row.studentId === studentId || row.canonicalStudentId === studentId);
    return rows.sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
  },
};
