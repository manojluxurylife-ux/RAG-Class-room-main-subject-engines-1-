/**
 * child-analytics — the ONE place the eight evaluation analytics are
 * computed. Extracted verbatim from /api/parent/child-analytics so the
 * parent portal and the student app's Parent's Corner page can never
 * drift apart: same student, same numbers, whichever door a parent
 * walks in through.
 *
 * Every number traces back to something the student actually did in
 * Study Materials — completionLog timestamps, quizAttempts with Bloom's
 * tagging, segment titles. Nothing is simulated or invented.
 */
import { studentsStore } from "@/lib/students-store";
import { studyMaterialsStore } from "@/lib/study-materials-store";
import { COMPETENCY_BLOOMS_LEVELS, BLOOMS_LEVELS, type BloomsLevel } from "@/lib/study-material-schema";
import { computeTopicMastery } from "@/lib/mastery";
import { chapterAssessmentsStore } from "@/lib/chapter-assessments";

const MIN_ATTEMPTS_FOR_WEAK_TOPIC = 2; // avoid one lucky/unlucky guess mislabeling a topic
const REVISION_DUE_DAYS = 7;

export interface ChildAnalytics {
  student: { name: string; className: string; syllabus: string };
  learningObjectives: { subject: string; materialTitle: string; objective: string }[];
  bloomsMapping: { level: string; attempts: number; accuracyPct: number | null }[];
  competencyMapping: { attempts: number; accuracyPct: number | null };
  weakTopics: { topic: string; subject: string; attempts: number; accuracyPct: number }[];
  studyPlan: { revise: string[]; continue: string[] };
  dueForRevision: { topic: string; daysSinceLastActivity: number }[];
  masteryBySubject: { subject: string; masteryScore: number; completionPct: number; quizAccuracyPct: number | null }[];
  readinessBySubject: { subject: string; readiness: string; masteryScore: number }[];
  chapterTests: { subject: string; textbookTitle: string; chapterTitle: string; score: number; total: number; percentage: number; passed: boolean; attemptedAt: string }[];
}

/** Returns null if the student doesn't exist. */
export async function buildChildAnalytics(studentId: string): Promise<ChildAnalytics | null> {
  const student = await studentsStore.byId(studentId) || await studentsStore.byEmail(studentId);
  if (!student) return null;

  const materials = await studyMaterialsStore.byStudent(studentId);

  // ── 1. Learning Objectives — what's genuinely been completed ──
  const learningObjectives = materials.flatMap(m =>
    m.segments
      .filter(s => m.progress.completedSegmentIds.includes(s.id))
      .map(s => ({ subject: m.subject, materialTitle: m.title, objective: s.heading })),
  );

  // ── Flatten every quiz attempt across every material, once, reused below ──
  type FlatAttempt = { subject: string; segmentHeading: string; correct: boolean; attemptedAt: string; bloomsLevel?: BloomsLevel };
  const allAttempts: FlatAttempt[] = materials.flatMap(m =>
    (m.progress.quizAttempts || []).map(a => ({
      subject: m.subject, segmentHeading: a.segmentHeading, correct: a.correct,
      attemptedAt: a.attemptedAt, bloomsLevel: a.bloomsLevel,
    })),
  );

  // ── 2. Bloom's Taxonomy Mapping — real distribution across actual attempts ──
  const bloomsMapping = BLOOMS_LEVELS.map(level => {
    const atLevel = allAttempts.filter(a => a.bloomsLevel === level);
    const correct = atLevel.filter(a => a.correct).length;
    return {
      level, attempts: atLevel.length,
      accuracyPct: atLevel.length > 0 ? Math.round((correct / atLevel.length) * 100) : null,
    };
  }).filter(b => b.attempts > 0); // only show levels the child has actually been tested on

  // ── 3. Competency Mapping — derived from Bloom's Apply/Analyze/Evaluate/Create ──
  const competencyAttempts = allAttempts.filter(a => a.bloomsLevel && COMPETENCY_BLOOMS_LEVELS.includes(a.bloomsLevel));
  const competencyMapping = {
    attempts: competencyAttempts.length,
    accuracyPct: competencyAttempts.length > 0
      ? Math.round((competencyAttempts.filter(a => a.correct).length / competencyAttempts.length) * 100)
      : null,
  };

  // ── 4. Weak Topic Analysis — recency-weighted mastery per topic, not
  // flat accuracy. Reused for the subject-level Mastery Score below too
  // (section 7) — one canonical "how well does this student know this
  // topic" definition, computed once, so the page can never show two
  // different numbers for the same topic depending on which card you're
  // looking at. Sorting by attemptedAt is required here, not optional —
  // the recency-weighting is meaningless (and silently wrong) on
  // attempts merged from multiple materials without re-sorting by real
  // timestamp first. ──
  const byTopic = new Map<string, { subject: string; attempts: FlatAttempt[] }>();
  for (const a of allAttempts) {
    const key = a.segmentHeading;
    if (!byTopic.has(key)) byTopic.set(key, { subject: a.subject, attempts: [] });
    byTopic.get(key)!.attempts.push(a);
  }
  const topicMastery = Array.from(byTopic.entries()).map(([topic, v]) => {
    const chronological = [...v.attempts].sort((a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime());
    const masteryPct = Math.round(computeTopicMastery(chronological.map(a => a.correct)) * 100);
    return { topic, subject: v.subject, attempts: v.attempts.length, masteryPct };
  });
  const weakTopics = topicMastery
    .filter(t => t.attempts >= MIN_ATTEMPTS_FOR_WEAK_TOPIC && t.masteryPct < 60)
    .sort((a, b) => a.masteryPct - b.masteryPct)
    .slice(0, 5)
    .map(t => ({ topic: t.topic, subject: t.subject, attempts: t.attempts, accuracyPct: t.masteryPct }));

  // ── 5. Personalized Study Plan — real, derived recommendations, not invented ──
  const incompleteMaterials = materials
    .filter(m => m.progress.unlockedIndex < m.segments.length)
    .map(m => ({ subject: m.subject, title: m.title, segmentsRemaining: m.segments.length - m.progress.unlockedIndex }));
  const studyPlan = {
    revise: weakTopics.slice(0, 3).map(t => `Revise "${t.topic}" (${t.subject}) — ${t.accuracyPct}% mastery so far`),
    continue: incompleteMaterials.slice(0, 3).map(m => `Continue "${m.title}" (${m.subject}) — ${m.segmentsRemaining} segment${m.segmentsRemaining !== 1 ? "s" : ""} left`),
  };

  // ── 6. Revision Schedule — topics not touched in REVISION_DUE_DAYS+ ──
  const now = Date.now();
  const lastActivityByTopic = new Map<string, number>();
  for (const a of allAttempts) {
    const t = new Date(a.attemptedAt).getTime();
    if (!lastActivityByTopic.has(a.segmentHeading) || t > lastActivityByTopic.get(a.segmentHeading)!) {
      lastActivityByTopic.set(a.segmentHeading, t);
    }
  }
  const dueForRevision = Array.from(lastActivityByTopic.entries())
    .map(([topic, lastMs]) => ({ topic, daysSinceLastActivity: Math.floor((now - lastMs) / (1000 * 60 * 60 * 24)) }))
    .filter(t => t.daysSinceLastActivity >= REVISION_DUE_DAYS)
    .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);

  // ── 7. Mastery Score — per subject: 50% chapter completion + 50% the
  // average of each topic's recency-weighted mastery (topicMastery,
  // computed once above — not a separate flat-accuracy recomputation) ──
  const subjects = Array.from(new Set(materials.map(m => m.subject)));
  const masteryBySubject = subjects.map(subject => {
    const subjMaterials = materials.filter(m => m.subject === subject);
    const totalSegs = subjMaterials.reduce((s, m) => s + m.segments.length, 0);
    const doneSegs  = subjMaterials.reduce((s, m) => s + m.progress.completedSegmentIds.length, 0);
    const completionPct = totalSegs > 0 ? (doneSegs / totalSegs) * 100 : 0;

    const subjTopics = topicMastery.filter(t => t.subject === subject);
    const quizAccuracyPct = subjTopics.length > 0
      ? subjTopics.reduce((sum, t) => sum + t.masteryPct, 0) / subjTopics.length
      : completionPct; // no quiz data yet — don't punish the score, just use completion alone

    const masteryScore = Math.round(0.5 * completionPct + 0.5 * quizAccuracyPct);
    return { subject, masteryScore, completionPct: Math.round(completionPct), quizAccuracyPct: subjTopics.length > 0 ? Math.round(quizAccuracyPct) : null };
  });

  // ── 8. Estimated Exam Readiness — transparent heuristic label, not a scientific prediction ──
  const readinessBySubject = masteryBySubject.map(m => {
    const subjWeakTopics = weakTopics.filter(t => t.subject === m.subject).length;
    let readiness: "On Track" | "Needs More Practice" | "Needs Focused Revision";
    if (m.masteryScore >= 80 && subjWeakTopics === 0) readiness = "On Track";
    else if (m.masteryScore >= 50) readiness = "Needs More Practice";
    else readiness = "Needs Focused Revision";
    return { subject: m.subject, readiness, masteryScore: m.masteryScore };
  });

  const chapterTests = (await chapterAssessmentsStore.byStudent(studentId)).map(a => ({ subject: a.subject, textbookTitle: a.textbookTitle, chapterTitle: a.chapterTitle, score: a.score, total: a.total, percentage: a.percentage, passed: a.passed, attemptedAt: a.attemptedAt }));
  return {
    student: { name: student.name, className: student.className, syllabus: student.syllabus },
    learningObjectives,
    bloomsMapping,
    competencyMapping,
    weakTopics,
    studyPlan,
    dueForRevision,
    masteryBySubject,
    readinessBySubject, chapterTests,
  };
}
