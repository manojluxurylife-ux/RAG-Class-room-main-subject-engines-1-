/**
 * Shared safe-parse for AI-generated JSON — every generator in this app
 * (lessons, study material segments, slide decks, quiz materials) asks
 * Gemini/Gemma for raw JSON, and small models occasionally produce a
 * trailing comma, an unescaped quote, or a stray markdown fence despite
 * being told not to. Previously every call site duplicated the same
 * "strip fences, JSON.parse, hope for the best" logic with no recovery
 * path — a single malformed character meant the whole generation was
 * thrown away.
 *
 * `jsonrepair` (small, standalone, MIT, adopted from evaluating
 * dpaul0501/OpenVidya's dependency list) fixes exactly this class of
 * minor issue before we give up. Tested directly, including what it does
 * with genuinely unrecoverable input: `jsonrepair` guarantees the result
 * is *syntactically* valid JSON, not that it's the *shape* we wanted —
 * fed pure prose, it produced a valid-but-wrong 2-element string array
 * rather than throwing. That's fine, because it isn't the real safety
 * net here: the existing `isValidSegments()`/`isValidVisual()`/
 * `isValidSlideDeck()` checks downstream are unchanged and still do the
 * actual shape validation — confirmed directly, they correctly reject
 * that exact repaired-but-wrong-shape output. This module's only job is
 * "make it syntactically parseable if at all possible"; if it still
 * isn't, this throws.
 */
import { jsonrepair } from "jsonrepair";

export function parseAiJson<T = any>(raw: string): T {
  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Fall through to repair — most common real-world cases: a trailing
    // comma, a missing closing brace, or a stray comment the model added
    // despite instructions not to.
  }
  try {
    return JSON.parse(jsonrepair(clean));
  } catch (e: any) {
    throw new Error(`AI returned malformed JSON that couldn't be repaired: ${e.message}`);
  }
}
