/**
 * Splits a whole PAGE's worth of narration into paragraph-sized teaching
 * units, instead of one giant block read in a single breath.
 *
 * WHY THIS EXISTS: study materials were built from OCR'd page text —
 * one text blob per PDF page, not pre-split into paragraphs — and
 * `buildPreparedTeachingPack()` used that whole blob as a single scene's
 * `sourceNarration`. In the classroom, that meant the browser read an
 * entire page's worth of English in one uninterrupted pass before any
 * explanation started — genuinely distracting, and nothing like how a
 * teacher actually paces a lesson (one idea at a time: hear it, then
 * have it explained, then see it worked through).
 *
 * This function splits the SOURCE text into real paragraphs, and
 * distributes the EXPLANATION text across a matching number of chunks
 * so each source paragraph gets its own explanation portion that plays
 * right after it — "as if the AI heard the paragraph and is now
 * explaining what was just read," even though every word here is
 * pre-generated, not actually live.
 *
 * HONEST LIMITATION: the explanation text wasn't originally written
 * paragraph-by-paragraph — it's one prose explanation of the whole
 * topic. Distributing it proportionally (matching sentence count to
 * paragraph count, in the same order) is a reasonable approximation
 * when the explanation follows the source's own order (the common
 * case for a linear textbook passage), not a guaranteed exact
 * correspondence. This is pacing, not perfect alignment.
 */

export interface TeachingUnit {
  source: string;
  explanation: string;
  /** Whiteboard-elaboration text for this unit — may be empty if the
   *  original solve/whiteboard text was too short to reach this unit;
   *  playback should skip the whiteboard step for an empty unit, not
   *  show an empty board. */
  solve: string;
}

const ABBREVIATIONS = /\b(?:Mr|Mrs|Ms|Dr|Prof|Fig|fig|St|approx|e\.g|i\.e|etc|vs|No)\.$/;

/** Splits into sentences, taking basic care not to split on abbreviation
 *  periods or decimal points (both common in textbook prose). */
function splitSentences(text: string): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "।" || ch === "॥") {
      const before = raw.slice(Math.max(0, i - 6), i + 1);
      const isDecimal = ch === "." && /\d$/.test(raw.slice(0, i)) && /^\d/.test(raw.slice(i + 1));
      const isAbbrev = ch === "." && ABBREVIATIONS.test(before);
      if (!isDecimal && !isAbbrev) {
        parts.push(raw.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  const rest = raw.slice(start).trim();
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

/** Splits page text into paragraphs. Real blank-line breaks are used
 *  when present (a well-formatted PDF's text layer often keeps them);
 *  otherwise falls back to grouping sentences into paragraph-sized
 *  clusters (2-4 sentences, capped by length) since OCR'd/flattened
 *  text frequently loses its original paragraph breaks entirely. */
export function splitIntoParagraphs(text: string, maxParagraphs = 6): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const byBlankLine = raw.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 20);
  if (byBlankLine.length >= 2) return byBlankLine.slice(0, maxParagraphs);

  // Math/table-heavy textbook pages — price tables, working-out steps,
  // equations like "2x + 3y = 110" — are often light on '.', '!', '?'
  // punctuation but DO still preserve individual line breaks from the
  // PDF's text layer. Without this, splitSentences below sees the
  // whole page as one (or zero) "sentences" and buildTeachingUnits
  // gives up entirely, silently falling back to a single unbroken
  // block — exactly what was happening on algebra pages full of
  // unpunctuated equation lines. Group consecutive non-empty lines
  // into paragraph-sized clusters before falling all the way back to
  // sentence-clustering, which needs real prose to work with.
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    const targetGroups = Math.max(2, Math.min(maxParagraphs, Math.ceil(lines.length / 2)));
    const perLineGroup = Math.ceil(lines.length / targetGroups);
    const byLineGroup: string[] = [];
    for (let i = 0; i < lines.length; i += perLineGroup) {
      byLineGroup.push(lines.slice(i, i + perLineGroup).join(" ").trim());
    }
    if (byLineGroup.length >= 2) return byLineGroup.slice(0, maxParagraphs);
  }

  const sentences = splitSentences(raw.replace(/\n+/g, " "));
  if (sentences.length <= 1) return sentences.length ? [raw] : [];

  const targetCount = Math.max(1, Math.min(maxParagraphs, Math.ceil(sentences.length / 3)));
  const perGroup = Math.ceil(sentences.length / targetCount);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += perGroup) {
    paragraphs.push(sentences.slice(i, i + perGroup).join(" ").trim());
  }
  return paragraphs;
}

/** Distributes `text`'s sentences across exactly `count` chunks, in
 *  order, as evenly as possible. If `text` has fewer sentences than
 *  `count`, later chunks come back empty (playback treats an empty
 *  chunk as "nothing new to say here" and moves on) rather than
 *  repeating or fabricating content. */
function distributeIntoChunks(text: string, count: number): string[] {
  const sentences = splitSentences(text);
  if (count <= 0) return [];
  if (!sentences.length) return new Array(count).fill("");
  const perChunk = sentences.length / count;
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.round(i * perChunk);
    const end = Math.round((i + 1) * perChunk);
    chunks.push(sentences.slice(start, Math.max(start, end)).join(" ").trim());
  }
  return chunks;
}

/**
 * Builds the paragraph-by-paragraph teaching sequence for one scene.
 * Returns an empty array (never throws) if there's no real source text
 * to teach from — callers should fall back to the existing whole-block
 * behavior in that case, not assume a paragraph structure exists.
 */
export function buildTeachingUnits(sourceText: string, explanationText: string, solveText: string, maxParagraphs = 6): TeachingUnit[] {
  const paragraphs = splitIntoParagraphs(sourceText, maxParagraphs);
  if (paragraphs.length <= 1) return [];
  const explanations = distributeIntoChunks(explanationText, paragraphs.length);
  const solves = distributeIntoChunks(solveText, paragraphs.length);
  return paragraphs.map((source, i) => ({
    source,
    explanation: explanations[i] || "",
    solve: solves[i] || "",
  }));
}
