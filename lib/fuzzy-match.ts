/**
 * Small shared fuzzy text-matching utility — token-overlap scoring.
 * Originally built inline in lib/concept-kb.ts for matching a typed
 * topic against curated chapter names; extracted here since the same
 * logic is now also needed for matching a newly-generated study
 * material's title against existing published materials (to detect
 * "this already exists, don't publish a duplicate").
 */

const STOP_WORDS = new Set([
  "a","an","the","and","or","of","in","to","for","is","are","what","how",
  "why","about","explain","describe","teach","learn","me","my","i","on",
  "with","class","chapter","cbse","ncert","introduction","basics","basic",
]);

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

/** Overlap score: how many of textA's tokens appear in textB. Not
 *  symmetric — deliberately biased toward "does B cover what A asks
 *  for," which is the direction both current callers need. */
export function tokenOverlapScore(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  if (tokensA.length === 0) return 0;
  const haystack = textB.toLowerCase();
  return tokensA.filter(t => haystack.includes(t)).length;
}

/** 0-1 fraction of textA's tokens found in textB — useful for a
 *  threshold check (e.g. "at least 60% of the words overlap") rather
 *  than a raw count, which is sensitive to how long the query is. */
export function tokenOverlapFraction(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  if (tokensA.length === 0) return 0;
  return tokenOverlapScore(textA, textB) / tokensA.length;
}
