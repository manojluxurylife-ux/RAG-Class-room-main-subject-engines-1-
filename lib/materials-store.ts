/**
 * Materials store — backed by Firestore (see lib/firestore.ts for why;
 * this used to be a local JSON file, which silently loses data on
 * serverless deploys — migrated for the same reason as the other stores).
 *
 * Schema
 * ──────
 * Material {
 *   id           string
 *   title        string
 *   description  string
 *   subject      string
 *   boards       string[]   — [] = all boards
 *   grades       string[]   — [] = all grades
 *   languages    string[]   — [] = all languages/mediums — e.g. a Standard VI
 *                             Tamil-medium worksheet should only reach
 *                             students whose profile languageId is "tamil",
 *                             not every Standard VI student on that board
 *   fileType     string     — "pdf" | "image" | "video" | "other" | "text"
 *   source       string     — "drive" | "gcs" | "vps" | "generated"
 *   sourceRef    string     — Drive fileId | GCS object name | VPS relative path | "" for generated
 *   content      string?    — inline markdown/text body, only set when source === "generated"
 *   materialKind string?    — "lesson-plan" | "slides" | "quiz" | "flashcards" | "mind-map" |
 *                             "lab-manual" | "voice-script" | "revision-notes" — only for generated
 *   published    boolean
 *   addedAt      string
 *   addedBy      string
 *   sizeBytes    number
 * }
 */
import { collectionHelpers } from "./firestore-collection";

export type MaterialSource = "drive" | "gcs" | "vps" | "generated";
export type FileType       = "pdf" | "image" | "video" | "other" | "text" | "pptx";

export interface Material {
  id:           string;
  title:        string;
  description:  string;
  subject:      string;
  boards:       string[];
  grades:       string[];
  languages:    string[];
  fileType:     FileType;
  source:       MaterialSource;
  sourceRef:    string;
  content?:     string;
  materialKind?:string;
  published:    boolean;
  addedAt:      string;
  addedBy:      string;
  // Only set for student-contributed materials (auto-published from
  // Study Materials). Points back to the ORIGINAL student's structured
  // study_materials record — needed so a different student "downloading"
  // this can get a real, fully-structured copy (points/examples/quizzes/
  // Bloom's tagging/diagrams) imported straight into their own Classroom,
  // not just the flattened markdown text. Without this, "download" would
  // only ever be able to offer a plain-text file, never a real lesson.
  sourceStudyMaterialId?: string;
  // Copied from the original student's material at publish time — lets
  // the "available for your class" browse list show the actual
  // photographed textbook page, so a student can visually confirm it's
  // really their textbook before downloading, not just trust a title match.
  textbookImageRef?: string;
  sizeBytes:    number;
}

const col = collectionHelpers<Material>("materials");

export const materialsStore = {
  all: col.all,
  byId: col.byId,

  // Student view: published only, filtered by board & grade & language/
  // medium (empty languages[] on a material = published for all mediums),
  // and optionally by the student's own subject preferences (Settings) —
  // undefined/empty subjects means "no preference set," so everything
  // matching board+grade+language still shows (opt-out default, not opt-in).
  async forStudent(boardId: string, grade: string, subjects?: string[], languageId?: string): Promise<Material[]> {
    const all = await col.all();
    return all.filter(m =>
      m.published &&
      (m.boards.length === 0 || m.boards.includes(boardId)) &&
      (m.grades.length  === 0 || m.grades.includes(grade)) &&
      ((m.languages?.length ?? 0) === 0 || !languageId || m.languages.includes(languageId)) &&
      (!subjects || subjects.length === 0 || subjects.includes(m.subject)),
    );
  },

  /** Just the count of materials added after `since`, matching the same
   *  filters — powers the notification badge without fetching the full
   *  list. */
  async newCountForStudent(boardId: string, grade: string, subjects: string[] | undefined, since: string, languageId?: string): Promise<number> {
    const matches = await materialsStore.forStudent(boardId, grade, subjects, languageId);
    return matches.filter(m => new Date(m.addedAt).getTime() > new Date(since).getTime()).length;
  },

  /**
   * Checks whether a published material already exists for this EXACT
   * combination — subject + class + syllabus + language + topic, not
   * just standard/language/syllabus. That narrower scope matters: a
   * broader match (ignoring subject/topic) would mean the very first
   * material anyone publishes for a given class/language/board blocks
   * every other subject and every other topic from ever being generated
   * for that same group again — a real bug, not a style choice, so this
   * function is deliberately scoped to avoid it.
   *
   * Requires at least half of the new topic's meaningful words to appear
   * in an existing title before calling it a match — a soft fuzzy
   * threshold, not exact-string matching, since two AI-generated titles
   * for the same real-world topic are unlikely to be worded identically.
   */
  async findExistingForTopic(params: {
    subject: string; grade: string; boardId: string; languageId: string; topic: string;
  }): Promise<Material | null> {
    const { tokenOverlapFraction } = await import("./fuzzy-match");
    const candidates = await materialsStore.forStudent(params.boardId, params.grade, undefined, params.languageId);
    const sameSubject = candidates.filter(m => m.subject === params.subject && m.published);

    let best: Material | null = null;
    let bestFraction = 0;
    for (const m of sameSubject) {
      const fraction = tokenOverlapFraction(params.topic, m.title);
      if (fraction > bestFraction) { bestFraction = fraction; best = m; }
    }
    return bestFraction >= 0.5 ? best : null;
  },

  async add(data: Omit<Material, "id" | "addedAt">): Promise<Material> {
    return col.create({ ...data, addedAt: new Date().toISOString() });
  },

  update: col.update,
  remove: col.remove,
};
