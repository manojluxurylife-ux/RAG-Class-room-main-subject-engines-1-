import type { StudyMaterialQaReport } from "./study-material-qa";
import type { VisualizationPlan } from "./visualization-plan";

/**
 * Student-prepared study materials — the "kitchen" output.
 *
 * Different from lib/materials-store.ts (the admin-published library,
 * shared/public per board+grade): these are PERSONAL to the student who
 * uploaded the textbook page — their own prepared, multi-segment course
 * built from their own textbook, progressed through like a YouTube video
 * with a seek bar, and gated by quizzes before moving forward.
 *
 * "Segment" is the unit of progress — think of it like a video chapter:
 * a self-contained chunk of teaching (points + worked example), with an
 * optional MCQ gate before the next segment unlocks. Revisiting earlier
 * segments (rewind) is always allowed; skipping ahead past the furthest
 * unlocked point is not.
 */

export const BLOOMS_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;
export type BloomsLevel = typeof BLOOMS_LEVELS[number];
// CBSE's "competency-based" framework maps directly onto Bloom's higher-
// order tiers — a competency question is, by definition, one that asks
// a student to apply/analyze/evaluate/create, not just recall or
// understand. Rather than a wholly separate tag duplicating the same
// judgment, "competency-based" is derived FROM the Bloom's level, kept
// as one real classification instead of two that could disagree.
export const COMPETENCY_BLOOMS_LEVELS: BloomsLevel[] = ["apply", "analyze", "evaluate", "create"];

export interface StudyQuiz {
  question:      string;
  options:       string[];   // typically 4
  correctIndex:  number;
  // The AI classifies its own generated question by real Bloom's Taxonomy
  // level — this is what makes Bloom's/Competency-Mapping analytics
  // honest rather than fabricated: without this field there's no real
  // data to aggregate a "Bloom's breakdown" from at all.
  bloomsLevel?:  BloomsLevel;
}

export interface TextbookCue {
  /** Verbatim source phrase used for searchable PDFs. */
  quote?: string;
  /** 1-based PDF page number. */
  page?: number;
  /** Percentage fallback for scans/photos: x/y/width/height are 0-100. */
  region?: { x: number; y: number; width: number; height: number };
}

export interface StudySegment {
  id:       string;
  heading:  string;
  points:   string[];
  example?: { problem: string; steps: string[]; answer: string };
  quiz?:    StudyQuiz;        // if present, must be answered correctly to unlock the next segment
  // Same Visual type/renderer as the ad-hoc lesson flow (lib/visual-schema.ts)
  // — was missing here entirely until now, so Study Material segments could
  // never show a diagram regardless of topic. Same rule applies: the AI
  // only ever supplies small checkable parameters, never coordinates —
  // the actual drawing is always done by real code (components/visuals/).
  visual?:  unknown; // legacy single visual
  visualizationPlan?: VisualizationPlan; // generated with the material, rendered phase-by-phase during teaching
  /** One source target per flattened teaching line: points, then example problem/steps/answer. */
  textbookCues?: TextbookCue[];
}

export const STUDY_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Geography", "Computer Science",
] as const;
export type StudySubject = typeof STUDY_SUBJECTS[number];

/** One timestamped segment-completion event — the raw material for
 *  date-wise attendance ("did they study X on day Y"), not just a flat
 *  "which segments are done" set with no sense of when. */
export interface CompletionLogEntry {
  segmentId:   string;
  completedAt: string;   // ISO date
}

/** Every quiz attempt, right or wrong — a flat "which quizzes did they
 *  pass" list can't answer "how many tries did this take" or "what's
 *  their actual accuracy," so every attempt gets its own record. */
export interface QuizAttempt {
  id:            string;
  segmentId:     string;
  segmentHeading:string;
  question:      string;
  correct:       boolean;
  attemptedAt:   string;   // ISO date
  // Denormalized from the segment's quiz at attempt time — kept on the
  // attempt record itself (not just looked up from the segment) so
  // historical analytics stay accurate even if a material is edited or
  // deleted later.
  bloomsLevel?:  BloomsLevel;
}

export interface StudyMaterialProgress {
  unlockedIndex:       number;               // furthest segment index the student has reached (0-based)
  completedSegmentIds: string[];              // segments whose quiz (if any) has been passed — kept for the existing gating checks
  completionLog:        CompletionLogEntry[]; // every completion, timestamped
  quizAttempts:          QuizAttempt[];       // every quiz attempt, right or wrong
}

export type ExtraMaterialKind = "flashcards" | "quiz" | "notes" | "mindmap";

export interface StudyMaterial {
  id:               string;
  studentId:        string;   // owner — these are private to the uploading student
  title:            string;
  subject:          StudySubject;
  className:        string;   // e.g. "IX" — matches the student's own Roman-numeral class field
  syllabus:         string;   // board id: cbse | kerala | tamilnadu | karnataka
  sourceLanguage:   string;   // language the uploaded textbook page is written in
  targetLanguage:   string;   // language the generated study material is written in
  textbookImageRef?:string;   // GCS object path for the original page/PDF
  textbookMimeType?: string;  // preserves PDF/image type for continuation
  sourceText?:       string;  // OCR/transcript returned during grounded generation
  sourceTopics?:     string[];// key textbook topics used for coverage QA
  segments:         StudySegment[];
  // Which pipeline produced this — "local" means the Gemini-based
  // server generation failed and the three-stage on-device fallback
  // (lib/client/local-material-fallback.ts: Qwen3.5 vision → VibeThinker
  // → Qwen3.5 translate) produced it instead. Locally-generated
  // materials are always a single complete segment (no multi-segment
  // continuation, no diagrams) — see that file's comments for why.
  generatedBy?:     "gemini" | "local";
  progress:         StudyMaterialProgress;
  // On-demand extras generated from the SAME uploaded page, without a
  // second upload — the student-facing equivalent of Creator Studio's
  // Flashcards/Quiz/Revision-Notes/Mind-Map generators, but self-served
  // from their own material instead of admin-authored. Populated lazily,
  // one at a time, as the student requests each one — never all at once.
  extras?:          Partial<Record<ExtraMaterialKind, string>>;
  // Progressive generation — segment 1 is generated and shown fast;
  // remaining segments generate in a follow-up call while the student
  // is already reading. "partial" means more segments are still coming;
  // roadmap is the short one-line plan for what they'll cover, used to
  // keep the follow-up call consistent with segment 1's content and
  // tone. Auto-publish to the shared library (see materials-store.ts)
  // deliberately waits for "complete" — publishing a partial course to
  // other students would be a real, confusing bug, not a minor one.
  generationStatus?:"queued" | "processing" | "partial" | "complete" | "failed";
  processing?: {
    stage: "upload" | "first-segment" | "continuation" | "qa" | "publish" | "complete" | "failed";
    attempts: number;
    startedAt?: string;
    completedAt?: string;
    lastError?: string;
    requestId?: string;
  };
  roadmap?:         string[];
  // Set once continue-generation successfully auto-publishes this
  // material — prevents a retried/duplicate call from publishing the
  // same material twice into the shared admin pool.
  publishedMaterialId?: string;
  qaReport?: StudyMaterialQaReport;
  createdAt:        string;
  updatedAt:        string;
}

/** Loose runtime check for AI-generated JSON before it's trusted. */
export function isValidSegments(v: any): v is StudySegment[] {
  return Array.isArray(v) && v.length > 0 && v.every(s =>
    s && typeof s.heading === "string" && Array.isArray(s.points),
  );
}

/** Renders structured segments as readable markdown — used when a
 *  student's material is published to the shared admin pool, since that
 *  store keeps a flat markdown `content` string, not structured
 *  segments/progress/quiz-gating (those are specific to the personal,
 *  self-paced Study Materials experience). */
export function segmentsToMarkdown(title: string, segments: StudySegment[]): string {
  const parts = [`# ${title}`, ""];
  for (const s of segments) {
    parts.push(`## ${s.heading}`, "");
    for (const p of s.points) parts.push(`- ${p}`);
    if (s.example) {
      parts.push("", "**Worked example:** " + s.example.problem);
      s.example.steps.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
      parts.push(`**Answer:** ${s.example.answer}`);
    }
    if (s.quiz) {
      parts.push("", `**Check yourself:** ${s.quiz.question}`);
      s.quiz.options.forEach((opt, i) => parts.push(`${i === s.quiz!.correctIndex ? "- ✓" : "-"} ${opt}`));
    }
    parts.push("");
  }
  return parts.join("\n");
}
