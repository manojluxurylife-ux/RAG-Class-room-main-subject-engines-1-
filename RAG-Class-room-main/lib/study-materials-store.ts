/**
 * Firestore store for student-prepared study materials (see
 * lib/study-material-schema.ts for the "why this is different from
 * lib/materials-store.ts" explanation).
 */
import { collectionHelpers } from "./firestore-collection";
import { nanoid } from "nanoid";
import type { StudyMaterial, ExtraMaterialKind, BloomsLevel } from "./study-material-schema";

const col = collectionHelpers<StudyMaterial>("study_materials");

export const studyMaterialsStore = {
  byId: col.byId,
  all: col.all,

  async byStudent(studentId: string): Promise<StudyMaterial[]> {
    const items = await col.where("studentId", studentId);
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async create(data: Omit<StudyMaterial, "id" | "createdAt" | "updatedAt" | "progress">): Promise<StudyMaterial> {
    const now = new Date().toISOString();
    return col.create({
      ...data,
      progress: { unlockedIndex: 0, completedSegmentIds: [], completionLog: [], quizAttempts: [] },
      processing: data.processing || { stage: data.generationStatus === "complete" ? "complete" : "first-segment", attempts: 1, startedAt: now },
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Called when a student finishes a segment. If that segment has no
   * quiz, or the quiz was answered correctly, the next segment unlocks.
   * Rewinding to review an earlier (already-unlocked) segment never
   * calls this — it's a pure read, no progress mutation.
   *
   * Also appends a timestamped completionLog entry — this is the raw
   * data the /progress page's date-wise attendance view is built from;
   * the old completedSegmentIds-only tracking had no sense of *when*
   * something was completed, only *whether*.
   */
  async advance(id: string, completedSegmentId: string): Promise<StudyMaterial | null> {
    const material = await col.byId(id);
    if (!material) return null;
    const idx = material.segments.findIndex(s => s.id === completedSegmentId);
    if (idx === -1) return material;

    const completedSegmentIds = material.progress.completedSegmentIds.includes(completedSegmentId)
      ? material.progress.completedSegmentIds
      : [...material.progress.completedSegmentIds, completedSegmentId];

    const unlockedIndex = Math.max(material.progress.unlockedIndex, idx + 1);
    const completionLog = [
      ...(material.progress.completionLog || []),
      { segmentId: completedSegmentId, completedAt: new Date().toISOString() },
    ];

    return col.update(id, {
      progress: { ...material.progress, unlockedIndex, completedSegmentIds, completionLog },
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Records a single quiz attempt — right or wrong. Called on every
   * "Check answer" click in the player, not just successful ones, so
   * /progress's test-results view reflects real accuracy (how many
   * tries something took), not just a final pass/fail flag.
   */
  async recordQuizAttempt(
    id: string,
    segmentId: string,
    segmentHeading: string,
    question: string,
    correct: boolean,
    bloomsLevel?: BloomsLevel,
  ): Promise<StudyMaterial | null> {
    const material = await col.byId(id);
    if (!material) return null;

    const attempt = {
      id: nanoid(8), segmentId, segmentHeading, question, correct, bloomsLevel,
      attemptedAt: new Date().toISOString(),
    };
    const quizAttempts = [...(material.progress.quizAttempts || []), attempt];

    return col.update(id, {
      progress: { ...material.progress, quizAttempts },
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Used when quiz gating is OFF (see lib/student-session.ts's
   * quizGatingEnabled) — the student navigated directly to a segment
   * further than they've reached before, without going through the
   * segment-by-segment advance() flow. Bumps the "furthest reached"
   * marker so resume-from-last-position still works, but does NOT mark
   * any quiz as passed, and does NOT log a completion event — free
   * navigation isn't counted as "attendance" the same way genuine
   * segment completion is.
   */
  async jumpTo(id: string, targetIndex: number): Promise<StudyMaterial | null> {
    const material = await col.byId(id);
    if (!material) return null;
    const unlockedIndex = Math.max(material.progress.unlockedIndex, targetIndex + 1);
    return col.update(id, {
      progress: { ...material.progress, unlockedIndex },
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Saves an on-demand extra (flashcards/quiz/notes/mindmap) generated
   * from the same uploaded page — never overwrites the segments/progress
   * that drive the actual course.
   */
  async saveExtra(id: string, kind: ExtraMaterialKind, content: string): Promise<StudyMaterial | null> {
    const material = await col.byId(id);
    if (!material) return null;
    return col.update(id, {
      extras: { ...(material.extras || {}), [kind]: content },
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Appends stage-2-generated segments to a material created with only
   * its first segment (see the progressive generation flow), and marks
   * it complete. Never touches segment 1 or any progress already made.
   */
  async updateProcessing(id: string, patch: NonNullable<StudyMaterial["processing"]>): Promise<StudyMaterial | null> {
    return col.update(id, { processing: patch, updatedAt: new Date().toISOString() });
  },

  async appendSegments(id: string, newSegments: StudyMaterial["segments"]): Promise<StudyMaterial | null> {
    const material = await col.byId(id);
    if (!material) return null;
    return col.update(id, {
      segments: [...material.segments, ...newSegments],
      generationStatus: "complete",
      processing: { stage: "qa", attempts: (material.processing?.attempts || 1), startedAt: material.processing?.startedAt },
      roadmap: [],
      updatedAt: new Date().toISOString(),
    });
  },

  async saveQaReport(id: string, qaReport: StudyMaterial["qaReport"]): Promise<StudyMaterial | null> {
    return col.update(id, { qaReport, updatedAt: new Date().toISOString() });
  },

  /** Records which admin-pool material this was auto-published as, so a
   *  retried continue-generation call doesn't publish it a second time. */
  async markPublished(id: string, publishedMaterialId: string): Promise<StudyMaterial | null> {
    return col.update(id, { publishedMaterialId, updatedAt: new Date().toISOString() });
  },

  remove: col.remove,
};
