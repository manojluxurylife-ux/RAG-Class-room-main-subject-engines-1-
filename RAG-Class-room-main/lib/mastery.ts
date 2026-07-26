/**
 * Per-topic mastery scoring — recency-weighted with a confidence cap.
 * Adapted from HKUDS/DeepTutor's `deeptutor/learning/mastery.py`
 * (Apache 2.0, genuinely permissive — checked the actual LICENSE file
 * directly, unlike OpenVidya's AGPL-3.0, so this isn't a "reimplement
 * the idea to avoid a license problem" situation like concept-kb.ts/
 * lab-kb.ts were; it's a straightforward, legitimate adoption of a
 * well-designed formula). Reimplemented in TypeScript since the
 * original is Python — no code to literally copy either way, but the
 * algorithm itself is exactly theirs.
 *
 * Replaces this app's previous mastery formula: a flat
 * `(correct attempts / total attempts)` blended with completion% across
 * a student's ENTIRE history for a topic, which had two real weaknesses:
 *   1. A student who struggled early but has since improved shows the
 *      same score as one who's still struggling right now — old
 *      mistakes and recent ones counted identically.
 *   2. A single lucky guess could show 100% "mastery" of a topic with
 *      exactly one data point.
 *
 * This formula fixes both: the most recent attempts count more (recency
 * weighting), and mastery literally cannot exceed 0.5 after one attempt
 * or 0.8 after two, regardless of correctness — there has to be enough
 * evidence before claiming real mastery.
 */

// Weights for the most recent attempts, oldest → newest. Aligned to the
// END of this array, not the start — even with only 2 real attempts,
// the most recent one still gets weight 1.0 (the highest), not 0.7.
const RECENCY_WEIGHTS: readonly number[] = [0.5, 0.7, 0.85, 0.95, 1.0];

// Mastery can't exceed this until enough attempts accumulate — 3+
// attempts are needed before a topic can show full-scale mastery at all.
const CONFIDENCE_CAP: Record<number, number> = { 1: 0.5, 2: 0.8 };

/**
 * Returns a 0-1 mastery score from a topic's attempt outcomes.
 *
 * IMPORTANT: `correctnessChronological` must be in chronological order,
 * oldest attempt first — the whole point of recency-weighting breaks
 * silently (and wrongly) if attempts from different sources get merged
 * without re-sorting by real timestamp first. This function does not
 * sort for you, since it only receives booleans, not timestamps — every
 * caller is responsible for sorting by attemptedAt before calling this.
 */
export function computeTopicMastery(correctnessChronological: boolean[]): number {
  if (correctnessChronological.length === 0) return 0;
  const recent = correctnessChronological.slice(-RECENCY_WEIGHTS.length);
  const weights = RECENCY_WEIGHTS.slice(-recent.length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = recent.reduce((sum, correct, i) => sum + weights[i] * (correct ? 1 : 0), 0);
  const score = weightedSum / totalWeight;
  const cap = CONFIDENCE_CAP[recent.length] ?? 1.0;
  return Math.min(score, cap);
}
