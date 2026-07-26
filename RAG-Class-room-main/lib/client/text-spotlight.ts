/**
 * Pure matching logic behind TextbookPageView's spotlight "torch beam" —
 * extracted so it's independently testable. No behavior change from
 * what TextbookPageView already did inline; this is a straight
 * extraction, made more worth testing now that
 * app/(student)/rag-classroom/page.tsx feeds it a new phrase on every
 * paragraph instead of once per scene.
 */

export interface TextItemBox { str: string; x: number; y: number; w: number; h: number }

/** Unicode-aware normalization so Malayalam/Hindi text (and any other
 *  script) matches correctly, not just Latin text — lowercases,
 *  collapses punctuation/whitespace differences that commonly differ
 *  between OCR'd/extracted text and a PDF's own embedded text layer. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Finds the run of consecutive text items whose text, once joined and
 * normalized, contains `phrase` — precisely: only the items that
 * actually overlap the matched substring are returned, never extra
 * items accumulated before the match happened to start (a real
 * precision issue in an earlier version of this function — matching
 * "Pairs of Equations" inside "Chapter 7: Pairs of Equations" must
 * spotlight only "Pairs of Equations", not the whole run including
 * "Chapter 7:").
 *
 * Returns null (not an error, not a guess) when nothing matches — a
 * scanned page with no text layer, or a phrase the model/extraction
 * didn't quote verbatim, are both real, expected cases: a missing
 * spotlight is honest; a wrong one would not be.
 */
export function findPhraseMatch(itemBoxes: TextItemBox[], phrase: string): TextItemBox[] | null {
  const target = normalize(phrase);
  if (target.length < 4 || itemBoxes.length === 0) return null;

  // One normalized string for the whole page, with a record of which
  // item each character range belongs to — lets a single substring
  // search find the match's exact character span, then only the items
  // truly inside that span are returned.
  let combined = "";
  const spans: { start: number; end: number; item: TextItemBox }[] = [];
  for (const it of itemBoxes) {
    const t = normalize(it.str);
    if (!t) continue;
    if (combined) combined += " ";
    const start = combined.length;
    combined += t;
    spans.push({ start, end: combined.length, item: it });
  }

  const matchStart = combined.indexOf(target);
  if (matchStart === -1) return null;
  const matchEnd = matchStart + target.length;

  const matched = spans.filter(s => s.start < matchEnd && s.end > matchStart).map(s => s.item);
  return matched.length ? matched : null;
}

export interface PctBox { left: number; top: number; width: number; height: number }

/** Converts a matched run of text-item boxes (canvas pixel coordinates)
 *  into a percentage-based bounding box for CSS overlay positioning —
 *  stays pixel-accurate at any display width with no resize listeners. */
export function boxesToPercentBounds(matched: TextItemBox[], canvasSize: { w: number; h: number }, pad = 6): PctBox {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of matched) {
    x1 = Math.min(x1, b.x);       y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
  }
  return {
    left:   Math.max(0, (x1 - pad) / canvasSize.w * 100),
    top:    Math.max(0, (y1 - pad) / canvasSize.h * 100),
    width:  Math.min(100, (x2 - x1 + pad * 2) / canvasSize.w * 100),
    height: Math.min(100, (y2 - y1 + pad * 2) / canvasSize.h * 100),
  };
}
