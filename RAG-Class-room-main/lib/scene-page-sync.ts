/**
 * Finds which lesson scene a PDF page belongs to — the logic behind
 * keeping the PDF viewer, AI notes, and whiteboard on the same page
 * number at all times. Extracted as a pure function (taking scenes
 * explicitly rather than reading from component state) so it's
 * independently testable; app/(student)/rag-classroom/page.tsx's
 * goToPage() calls this with `lesson?.scenes`.
 *
 * Exact match preferred; falls back to the closest PRECEDING scene for
 * a page with no dedicated teaching scene (e.g. a title/reference page
 * the lesson skipped), so the notes/whiteboard land on the most
 * relevant available content rather than nothing. Returns -1 when
 * there's no lesson loaded, or no scene at or before this page exists.
 */
export function findSceneIndexForPage(scenes: { sourcePage?: number }[] | undefined | null, page: number): number {
  if (!Array.isArray(scenes) || !scenes.length) return -1;

  const exact = scenes.findIndex(sc => Number(sc.sourcePage) === page);
  if (exact !== -1) return exact;

  let best = -1, bestPage = -1;
  scenes.forEach((sc, i) => {
    const p = Number(sc.sourcePage);
    if (Number.isFinite(p) && p <= page && p > bestPage) { bestPage = p; best = i; }
  });
  return best;
}
