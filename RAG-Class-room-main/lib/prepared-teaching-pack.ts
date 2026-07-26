"use client";

import type { OfflineMaterialRecord } from "@/lib/offline-materials";
import { normalizeWhiteboardPlan } from "@/lib/whiteboard-commands";
import { buildTeachingUnits } from "@/lib/paragraph-units";

type PackOptions = {
  documentId: string;
  grade?: string;
  sourceLanguage: string;
  teachingLanguage: string;
  materialLanguage: string;
};

const preferredTypes = ["classroom", "discussion", "whiteboard", "revision_notes"];

function words(value: unknown) {
  return new Set(clean(value).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

function overlap(a: unknown, b: unknown) {
  const left = words(a), right = words(b);
  if (!left.size || !right.size) return 0;
  let common = 0; left.forEach(word => { if (right.has(word)) common++; });
  return common / Math.min(left.size, right.size);
}

function sourceFor(material: any, section: any) {
  const sources = Array.isArray(material?.sources) ? material.sources : [];
  const ids = Array.isArray(section?.sourceIds) ? section.sourceIds : [];
  const cited = sources.find((source: any) => ids.includes(source.id));
  if (cited) return cited;
  const explicitPage = Number(section?.sourcePage || section?.page);
  if (explicitPage > 0) return sources.find((source: any) => Number(source.page) === explicitPage);
  const sectionText = [section?.heading, section?.content, section?.activity, section?.answer, section?.question].filter(Boolean).join(" ");
  const inPart = sources.filter((source: any) => !section?.sourcePageStart || (Number(source.page) >= Number(section.sourcePageStart) && Number(source.page) <= Number(section.sourcePageEnd)));
  const ranked = (inPart.length ? inPart : sources).map((source: any) => ({ source, score: overlap(sectionText, source?.text) })).sort((a: any, b: any) => b.score - a.score);
  return ranked[0]?.score >= 0.08 ? ranked[0].source : null;
}

function clean(value: unknown) { return String(value || "").trim(); }

function matchingSection(sections: any[], primary: any, index: number) {
  const ids = Array.isArray(primary?.sourceIds) ? primary.sourceIds : [];
  const cited = sections.find(item => Array.isArray(item?.sourceIds) && item.sourceIds.some((id: string) => ids.includes(id)));
  if (cited) return cited;
  const primaryText = [primary?.heading, primary?.content, primary?.activity, primary?.answer].filter(Boolean).join(" ");
  const ranked = sections.map(item => ({ item, score: overlap(primaryText, [item?.heading, item?.content, item?.activity, item?.answer].filter(Boolean).join(" ")) })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 0.12 ? ranked[0].item : sections[index];
}

function inferredVisual(textValue: unknown): any | undefined {
  const text = clean(textValue);
  const equation = /([+-]?\d*)x\s*([+-]\s*\d+)y\s*=\s*([+-]?\d+(?:\.\d+)?)/i.exec(text.replace(/\s+/g, ""));
  if (equation) {
    const a = Number(equation[1] === "" || equation[1] === "+" ? 1 : equation[1] === "-" ? -1 : equation[1]);
    const b = Number(equation[2].replace(/\s/g, "")); const c = Number(equation[3]);
    if (b) return { type: "graph", expression: `(${c} - (${a}) * x) / (${b})`, domain: [-10, 10], label: equation[0] };
  }
  if (/triangle|pythagoras|hypotenuse/i.test(text)) return { type: "geometry", shape: "right-triangle", legs: [3, 4], labels: { a: "a", b: "b", c: "hypotenuse" } };
  if (/circle|radius|diameter|circumference/i.test(text)) return { type: "geometry", shape: "circle", radius: 4, labels: { r: "radius" } };
  const fraction = /(\d+)\s*\/\s*(\d+)/.exec(text);
  if (fraction && Number(fraction[2])) return { type: "fraction", numerator: Number(fraction[1]), denominator: Number(fraction[2]), style: "pie" };
  if (/number line|integer|rational number/i.test(text)) return { type: "number-line", min: -5, max: 5, points: [{ value: 0, label: "0" }] };
  return undefined;
}

function isExpectedTeachingScript(text: string, language: string) {
  if (language !== "malayalam") return true;
  return /[\u0D00-\u0D7F]/.test(text);
}

function chapterQuestions(records: OfflineMaterialRecord[], section: any, index: number) {
  const quiz = records.find(record => record.materialType === "quiz_bank")?.data;
  const pool = Array.isArray(quiz?.questions) ? quiz.questions : Array.isArray(quiz?.sections) ? quiz.sections : [];
  const wantedIds = Array.isArray(section?.sourceIds) ? section.sourceIds : [];
  const related = pool.filter((q: any) => {
    const ids = Array.isArray(q?.sourceIds) ? q.sourceIds : [];
    return ids.some((id: string) => wantedIds.includes(id)) || clean(q?.chapter || q?.heading).toLowerCase().includes(clean(section?.heading).toLowerCase());
  });
  const candidates = related.length >= 5 ? related : (pool.length ? Array.from({ length: Math.min(5, pool.length) }, (_, offset) => pool[(index * 5 + offset) % pool.length]) : []);
  return candidates.slice(0, 5).map((q: any, qIndex: number) => {
    const options = Array.isArray(q.options) ? q.options.map(clean) : [];
    let correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : options.findIndex((o: string) => o === clean(q.correctAnswer || q.answer));
    if (correctIndex < 0) correctIndex = 0;
    return { id: `${index + 1}-${qIndex + 1}`, question: clean(q.question || q.heading || q.content), options, correctIndex, explanation: clean(q.explanation || q.answer), bloomsLevel: clean(q.bloomsLevel || "understand") };
  }).filter((q: any) => q.question && q.options.length >= 2);
}

/** Convert the already-created study material into a browser-playable class.
 * No AI call is made here: the same saved JSON is replayed every time. */
export function buildPreparedTeachingPack(records: OfflineMaterialRecord[], options: PackOptions) {
  const available = records.filter(record => record.documentId === options.documentId && Array.isArray(record.data?.sections));
  const primary = preferredTypes.map(type => available.find(record => record.materialType === type)).find(Boolean) || available[0];
  if (!primary) return null;

  const boardRecord = available.find(record => record.materialType === "whiteboard");
  const scriptRecord = available.find(record => record.materialType === "discussion");
  const sections = primary.data.sections || [];
  const boardSections = boardRecord?.data?.sections || [];
  const scriptSections = scriptRecord?.data?.sections || [];
  const scenes: any[] = [];
  const sources: any[] = [];
  const seenSources = new Set<string>();

  sections.forEach((section: any, index: number) => {
    const source = sourceFor(primary.data, section);
    // Never attach a lesson to an arbitrary PDF page. Ambiguous legacy
    // sections are omitted until their real source can be identified.
    if (!source) return;
    const sourceText = clean(source?.text);
    const scriptSection = matchingSection(scriptSections, section, index);
    const explanation = clean(scriptSection?.content || section.content || section.answer);
    const heading = clean(section.heading) || `Lesson ${index + 1}`;
    const page = Math.max(1, Number(source?.page || section.sourcePage || index + 1));
    const sourceId = clean(source?.id) || `P${page}-S${index + 1}`;
    if (!seenSources.has(sourceId)) {
      seenSources.add(sourceId);
      sources.push({ id: sourceId, page, text: sourceText || explanation.slice(0, 320) });
    }

    const boardSection = matchingSection(boardSections, section, index);
    const rawSolveText = clean(boardSection?.content || section.activity || section.answer);
    const solveText = isExpectedTeachingScript(rawSolveText, options.teachingLanguage)
      ? rawSolveText
      : options.teachingLanguage === "malayalam"
        ? `ഇപ്പോൾ ${heading} whiteboard-ൽ ഘട്ടം ഘട്ടമായി പരിഹരിക്കാം.`
        : rawSolveText;
    const teachingExplanation = explanation && isExpectedTeachingScript(explanation, options.teachingLanguage)
      ? explanation
      : options.teachingLanguage === "malayalam"
        ? `${heading} എന്ന ഭാഗത്തിന്റെ ആശയം ഇപ്പോൾ വിശദീകരിക്കാം. Technical terms English-ൽ തന്നെ നിലനിർത്തുന്നു.`
        : explanation;
    scenes.push({
      type: "teaching-unit", phase: "unit", title: heading,
      narration: teachingExplanation || solveText,
      sourceNarration: sourceText, explanationNarration: teachingExplanation,
      solveNarration: solveText, sourceLanguage: options.sourceLanguage,
      narrationLanguage: options.teachingLanguage,
      sourcePage: page, sourceIds: [sourceId], spotlight: sourceText.slice(0, 180),
      board: [boardSection?.heading || heading, solveText].filter(Boolean), question: clean(section.activity),
      visual: boardSection?.visual || section.visual || inferredVisual([heading, solveText].join(" ")),
      whiteboardCommands: normalizeWhiteboardPlan(boardSection?.whiteboardCommands, [boardSection?.heading || heading, solveText].filter(Boolean)),
      // Paragraph-by-paragraph teaching sequence: read one paragraph,
      // hear its own explanation right after (pre-built, but sequenced
      // to feel like the AI just heard and is now explaining that one
      // paragraph), then a whiteboard step for that paragraph — instead
      // of reading the whole page's text as one uninterrupted block.
      // Empty when the source has no real paragraph structure to split
      // (buildTeachingUnits' own signal to fall back to the whole-block
      // fields above) — playback must check length, not just presence.
      paragraphUnits: buildTeachingUnits(sourceText, teachingExplanation, solveText),
    });

    const lastScene = scenes[scenes.length - 1];
    if (lastScene) {
      lastScene.chapterEnd = true;
      lastScene.chapterId = `chapter-${index + 1}`;
      lastScene.chapterTitle = heading;
      lastScene.chapterQuestions = chapterQuestions(records, section, index);
    }
  });

  if (!scenes.length) return null;
  return {
    title: clean(primary.data.title || primary.title) || "Prepared textbook class",
    scenes,
    sources,
    documentId: options.documentId,
    textbookGrade: options.grade || null,
    lessonWorkflowVersion: "prepared-browser-v3-synchronized-units",
    preparedOffline: true,
    preparedFrom: available.map(record => ({ id: record.id, materialType: record.materialType, updatedAt: record.updatedAt })),
    languagePreferences: {
      sourceLanguage: options.sourceLanguage,
      teachingLanguage: options.teachingLanguage,
      materialLanguage: options.materialLanguage,
      teachingStyle: "target_with_english_terms",
    },
  };
}
