/**
 * Firestore store for Exam Room attempts — a full, timed, sectioned
 * exam paper, distinct from study_materials (a self-paced course) and
 * from Practice Materials (ephemeral, session-only, never persisted).
 * An exam attempt IS persisted — a student should be able to leave and
 * come back to a timed attempt, and review a past one afterward.
 */
import { collectionHelpers } from "./firestore-collection";
import type { ExamAttempt } from "./exam-schema";

const col = collectionHelpers<ExamAttempt>("exam_attempts");

export const examAttemptsStore = {
  byId: col.byId,

  async byStudent(studentId: string): Promise<ExamAttempt[]> {
    const items = await col.where("studentId", studentId);
    return items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  },

  async create(data: Omit<ExamAttempt, "id">): Promise<ExamAttempt> {
    return col.create(data);
  },

  async submit(id: string, fields: Partial<ExamAttempt>): Promise<ExamAttempt | null> {
    return col.update(id, fields);
  },
};
