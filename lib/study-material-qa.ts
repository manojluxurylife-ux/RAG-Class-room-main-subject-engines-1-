import { isValidVisualizationPlan } from "./visualization-plan";
import type { StudyMaterial, StudySegment } from "./study-material-schema";

export type QaStatus = "pending" | "passed" | "needs_review" | "failed" | "approved" | "rejected";
export type QaSeverity = "info" | "warning" | "error";

export interface QaFinding {
  code: string;
  severity: QaSeverity;
  message: string;
  segmentId?: string;
}

export interface QaMetric {
  key: string;
  label: string;
  score: number;
  weight: number;
  details: string;
}

export interface StudyMaterialQaReport {
  version: 1 | 2;
  status: QaStatus;
  overallScore: number;
  passThreshold: number;
  metrics: QaMetric[];
  findings: QaFinding[];
  checkedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0D00-\u0D7F]+/g, " ").trim();

function scoreStructure(segments: StudySegment[], findings: QaFinding[]): QaMetric {
  let score = 100;
  if (segments.length < 2) {
    score -= 25;
    findings.push({ code: "TOO_FEW_SEGMENTS", severity: "warning", message: "The material has fewer than two teaching segments." });
  }
  segments.forEach((s, index) => {
    if (!s.heading.trim()) {
      score -= 20;
      findings.push({ code: "MISSING_HEADING", severity: "error", message: `Segment ${index + 1} has no heading.`, segmentId: s.id });
    }
    if (!Array.isArray(s.points) || s.points.length < 2) {
      score -= 12;
      findings.push({ code: "THIN_SEGMENT", severity: "warning", message: `${s.heading || `Segment ${index + 1}`} has fewer than two teaching points.`, segmentId: s.id });
    }
  });
  return { key: "structure", label: "Structure & completeness", score: clamp(score), weight: 25, details: `${segments.length} segment(s) checked` };
}

function scoreContent(segments: StudySegment[], findings: QaFinding[]): QaMetric {
  let score = 100;
  let totalWords = 0;
  const seen = new Set<string>();
  for (const segment of segments) {
    const body = [segment.heading, ...segment.points, segment.example?.problem || "", ...(segment.example?.steps || []), segment.example?.answer || ""].join(" ");
    const count = words(body);
    totalWords += count;
    if (count < 35) {
      score -= 10;
      findings.push({ code: "LOW_DETAIL", severity: "warning", message: `${segment.heading} may be too brief for effective teaching.`, segmentId: segment.id });
    }
    for (const point of segment.points) {
      const key = normalized(point);
      if (key.length > 20 && seen.has(key)) {
        score -= 6;
        findings.push({ code: "DUPLICATE_POINT", severity: "warning", message: `A repeated teaching point was found in ${segment.heading}.`, segmentId: segment.id });
      }
      seen.add(key);
    }
  }
  if (totalWords < 120) score -= 15;
  return { key: "content", label: "Teaching depth", score: clamp(score), weight: 20, details: `${totalWords} words across teaching segments` };
}

function scoreQuizzes(segments: StudySegment[], findings: QaFinding[]): QaMetric {
  const quizzes = segments.filter(s => s.quiz);
  if (quizzes.length === 0) {
    findings.push({ code: "NO_QUIZZES", severity: "warning", message: "No knowledge-check quiz was generated." });
    return { key: "quizzes", label: "Quiz validity", score: 55, weight: 20, details: "No quizzes found" };
  }
  let score = 100;
  for (const segment of quizzes) {
    const q = segment.quiz!;
    if (q.options.length < 3) {
      score -= 25;
      findings.push({ code: "QUIZ_OPTIONS", severity: "error", message: `${segment.heading} has fewer than three answer options.`, segmentId: segment.id });
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      score -= 45;
      findings.push({ code: "INVALID_CORRECT_INDEX", severity: "error", message: `${segment.heading} has an invalid correct-answer index.`, segmentId: segment.id });
    }
    const unique = new Set(q.options.map(normalized));
    if (unique.size !== q.options.length) {
      score -= 15;
      findings.push({ code: "DUPLICATE_OPTIONS", severity: "error", message: `${segment.heading} contains duplicate quiz options.`, segmentId: segment.id });
    }
    if (!q.question.trim()) score -= 30;
  }
  return { key: "quizzes", label: "Quiz validity", score: clamp(score), weight: 20, details: `${quizzes.length} quiz question(s) checked` };
}

function scoreExamples(segments: StudySegment[], findings: QaFinding[]): QaMetric {
  const examples = segments.filter(s => s.example);
  if (examples.length === 0) {
    findings.push({ code: "NO_EXAMPLES", severity: "info", message: "No worked example was generated; this may be acceptable for some textbook pages." });
    return { key: "examples", label: "Worked examples", score: 70, weight: 10, details: "No worked examples" };
  }
  let score = 100;
  for (const s of examples) {
    const e = s.example!;
    if (!e.problem.trim() || !e.answer.trim() || e.steps.length === 0) {
      score -= 30;
      findings.push({ code: "INCOMPLETE_EXAMPLE", severity: "error", message: `${s.heading} has an incomplete worked example.`, segmentId: s.id });
    }
  }
  return { key: "examples", label: "Worked examples", score: clamp(score), weight: 10, details: `${examples.length} worked example(s) checked` };
}

function scoreSafetyAndLanguage(material: StudyMaterial, findings: QaFinding[]): QaMetric {
  const text = material.segments.flatMap(s => [s.heading, ...s.points, s.quiz?.question || ""]).join(" ");
  let score = 100;
  const suspicious = ["as an ai", "i cannot", "system prompt", "ignore previous", "```json"];
  for (const phrase of suspicious) {
    if (text.toLowerCase().includes(phrase)) {
      score -= 25;
      findings.push({ code: "MODEL_ARTIFACT", severity: "error", message: `Model-instruction text was detected: “${phrase}”.` });
    }
  }
  if (material.targetLanguage === "ml" || /malayalam/i.test(material.targetLanguage)) {
    const malayalamChars = (text.match(/[\u0D00-\u0D7F]/g) || []).length;
    if (malayalamChars < 20) {
      score -= 35;
      findings.push({ code: "LANGUAGE_MISMATCH", severity: "error", message: "The selected target is Malayalam, but very little Malayalam text was detected." });
    }
  }
  return { key: "language", label: "Language & generation hygiene", score: clamp(score), weight: 15, details: `Target language: ${material.targetLanguage}` };
}

function scoreVisuals(segments: StudySegment[], findings: QaFinding[]): QaMetric {
  const visualCount = segments.filter(s => s.visual).length;
  const subjectNeedsVisual = false;
  if (visualCount === 0 && subjectNeedsVisual) findings.push({ code: "NO_VISUAL", severity: "warning", message: "No visual was generated for a visual-heavy topic." });
  return { key: "visuals", label: "Visual readiness", score: visualCount > 0 ? 100 : 80, weight: 10, details: `${visualCount} coded visual(s) present` };
}


function tokens(text: string): Set<string> {
  return new Set(normalized(text).split(/\s+/).filter(t => t.length >= 4));
}

function scoreGrounding(material: StudyMaterial, findings: QaFinding[]): QaMetric {
  const source = material.sourceText || "";
  const topics = material.sourceTopics || [];
  if (!source.trim() && topics.length === 0) {
    findings.push({ code: "SOURCE_TRANSCRIPT_MISSING", severity: "error", message: "No OCR/source transcript is available, so factual grounding cannot be verified automatically." });
    return { key: "grounding", label: "Textbook grounding", score: 35, weight: 20, details: "Source transcript unavailable" };
  }
  const sourceTokens = tokens([source, ...topics].join(" "));
  const generated = material.segments.flatMap(s => [s.heading, ...s.points, s.example?.problem || "", ...(s.example?.steps || []), s.example?.answer || "", s.quiz?.question || ""]).join(" " );
  const generatedTokens = [...tokens(generated)];
  const overlap = generatedTokens.filter(t => sourceTokens.has(t)).length;
  const ratio = generatedTokens.length ? overlap / generatedTokens.length : 0;
  const coveredTopics = topics.filter(t => {
    const nt = normalized(t);
    return nt && normalized(generated).includes(nt);
  });
  let score = clamp(45 + ratio * 70);
  if (topics.length) score = clamp((score + (coveredTopics.length / topics.length) * 100) / 2);
  if (score < 70) findings.push({ code: "LOW_SOURCE_ALIGNMENT", severity: "error", message: "Generated material has weak overlap with the uploaded textbook source. Manual review is required." });
  else if (score < 85) findings.push({ code: "PARTIAL_SOURCE_COVERAGE", severity: "warning", message: "Some textbook topics may not be covered fully." });
  return { key: "grounding", label: "Textbook grounding", score, weight: 20, details: `${coveredTopics.length}/${topics.length || "?"} source topics covered` };
}

function scoreMathConsistency(material: StudyMaterial, findings: QaFinding[]): QaMetric {
  if (material.subject !== "Mathematics" && material.subject !== "Physics" && material.subject !== "Chemistry") {
    return { key: "math", label: "Formula consistency", score: 100, weight: 5, details: "Not a formula-heavy subject" };
  }
  let score = 100;
  const snippets = material.segments.flatMap(s => [s.example?.problem || "", ...(s.example?.steps || []), s.example?.answer || ""]);
  for (const text of snippets) {
    const opens = (text.match(/[({[]/g) || []).length;
    const closes = (text.match(/[)}\]]/g) || []).length;
    if (Math.abs(opens - closes) > 0) {
      score -= 12;
      findings.push({ code: "UNBALANCED_FORMULA", severity: "warning", message: "A worked example contains unbalanced brackets or formula delimiters." });
    }
    if (/=\s*(undefined|nan|infinity)/i.test(text)) {
      score -= 40;
      findings.push({ code: "INVALID_MATH_RESULT", severity: "error", message: "An invalid mathematical result was detected." });
    }
  }
  return { key: "math", label: "Formula consistency", score: clamp(score), weight: 5, details: `${snippets.filter(Boolean).length} formula/example line(s) checked` };
}

export function evaluateStudyMaterial(material: StudyMaterial, passThreshold = 85): StudyMaterialQaReport {
  const findings: QaFinding[] = [];
  const metrics = [
    scoreStructure(material.segments, findings),
    scoreContent(material.segments, findings),
    scoreQuizzes(material.segments, findings),
    scoreExamples(material.segments, findings),
    scoreSafetyAndLanguage(material, findings),
    scoreVisuals(material.segments, findings),
    scoreGrounding(material, findings),
    scoreMathConsistency(material, findings),
  ];
  const totalWeight = metrics.reduce((n, m) => n + m.weight, 0);
  const overallScore = clamp(metrics.reduce((n, m) => n + m.score * m.weight, 0) / totalWeight);
  const hasError = findings.some(f => f.severity === "error");
  const status: QaStatus = overallScore >= passThreshold && !hasError ? "passed" : overallScore >= 65 ? "needs_review" : "failed";
  return { version: 2, status, overallScore, passThreshold, metrics, findings, checkedAt: new Date().toISOString() };
}
