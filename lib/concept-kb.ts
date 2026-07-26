/**
 * Original concept-dependency grounding data — authored from scratch for
 * this app, not copied or adapted from any third-party source. This is
 * the legitimate way to build the "concept dependency graph" idea
 * evaluated from OpenVidya's kb-data/concept-graph.json: that specific
 * repo is AGPL-3.0 (a strong copyleft license with a network-use clause
 * — incorporating its actual code/data into this app would obligate
 * releasing this entire application's source under AGPL too, which is
 * incompatible with a closed-source commercial product). Copyright
 * protects their specific expression, not the underlying method — so
 * this file independently re-implements the *idea* (curate real
 * prerequisite chains, ground AI generation in them) using entirely
 * original content, written from real CBSE Class 10 Maths curriculum
 * knowledge, not derived from their files in any way.
 *
 * Seed set only — Mathematics, a handful of Class 10 CBSE chapters with
 * well-established, genuinely stable prerequisite structures (this
 * curriculum content hasn't meaningfully changed in decades, safe to
 * author directly rather than needing live verification). Expanding to
 * more subjects/classes/boards is real, ongoing content-curation work —
 * this is a deliberate starting point, not a finished system.
 */

import { tokenOverlapFraction, tokenize as sharedTokenize } from "./fuzzy-match";

export interface ConceptEntry {
  id:            string;
  name:          string;
  order:         number;       // teaching sequence within the chapter
  prerequisites: string[];     // concept ids (within this KB) that should be understood first
  keyIdea:       string;       // one-line summary of what this concept actually is
  commonError:   string;       // a real, specific misconception students often have here
  examWeight:    "high" | "medium" | "low";
}

export interface ConceptChapter {
  id:           string;
  chapterName:  string;
  subject:      string;   // matches STUDY_SUBJECTS in lib/study-material-schema.ts
  grade:        string;   // numeric, matches the rest of the app's grade convention
  concepts:     ConceptEntry[];
}

export const CONCEPT_KB: ConceptChapter[] = [
  {
    id: "cbse10-polynomials",
    chapterName: "Polynomials",
    subject: "Mathematics",
    grade: "10",
    concepts: [
      {
        id: "poly-degree-terms", name: "Degree and terms of a polynomial", order: 1,
        prerequisites: [],
        keyIdea: "The degree is the highest power of the variable; each term is a coefficient times a power of the variable.",
        commonError: "Students often confuse the degree of a polynomial with the number of terms it has — a 2-term polynomial can still have a high degree.",
        examWeight: "medium",
      },
      {
        id: "poly-zeroes", name: "Zeroes of a polynomial", order: 2,
        prerequisites: ["poly-degree-terms"],
        keyIdea: "A zero is a value of the variable that makes the polynomial equal to zero — graphically, where the curve crosses the x-axis.",
        commonError: "Students often think every polynomial must have as many real zeroes as its degree — quadratics can have 0, 1, or 2 real zeroes.",
        examWeight: "high",
      },
      {
        id: "poly-relation-zeroes-coeff", name: "Relationship between zeroes and coefficients", order: 3,
        prerequisites: ["poly-zeroes"],
        keyIdea: "For a quadratic ax² + bx + c, the sum of zeroes is -b/a and the product is c/a — this connects the roots directly to the coefficients without solving.",
        commonError: "Students frequently drop the negative sign on the sum-of-zeroes formula (-b/a), or mix up which formula is for sum vs. product.",
        examWeight: "high",
      },
      {
        id: "poly-division-algorithm", name: "Division algorithm for polynomials", order: 4,
        prerequisites: ["poly-degree-terms"],
        keyIdea: "Dividing one polynomial by another gives Dividend = Divisor × Quotient + Remainder, exactly like long division with numbers.",
        commonError: "Students often forget to write missing terms with a zero coefficient (e.g. no x² term) when setting up the division, which throws off the alignment of the whole calculation.",
        examWeight: "medium",
      },
    ],
  },
  {
    id: "cbse10-quadratic-equations",
    chapterName: "Quadratic Equations",
    subject: "Mathematics",
    grade: "10",
    concepts: [
      {
        id: "qe-standard-form", name: "Standard form and identifying a quadratic equation", order: 1,
        prerequisites: ["poly-degree-terms"],
        keyIdea: "A quadratic equation is any equation that can be rearranged into ax² + bx + c = 0, where a ≠ 0.",
        commonError: "Students sometimes classify an equation as quadratic just because it 'has an x²' somewhere, without checking it actually simplifies to that form after rearranging.",
        examWeight: "medium",
      },
      {
        id: "qe-factorisation", name: "Solving by factorisation", order: 2,
        prerequisites: ["qe-standard-form", "poly-zeroes"],
        keyIdea: "If a quadratic factors into (x - p)(x - q) = 0, then x = p or x = q, since a product is zero only when one factor is zero.",
        commonError: "Students often try to solve (x - p)(x - q) = k (a nonzero constant) the same way — this method only works when the product equals exactly zero.",
        examWeight: "high",
      },
      {
        id: "qe-completing-square", name: "Solving by completing the square", order: 3,
        prerequisites: ["qe-standard-form"],
        keyIdea: "Rewriting ax² + bx + c into a perfect-square form lets you solve by taking a square root directly.",
        commonError: "Students frequently forget to divide every term by 'a' first when a ≠ 1, leading to an incorrect square being completed.",
        examWeight: "medium",
      },
      {
        id: "qe-quadratic-formula", name: "The quadratic formula", order: 4,
        prerequisites: ["qe-completing-square"],
        keyIdea: "x = (-b ± √(b²-4ac)) / 2a solves any quadratic directly — it's completing the square done once, generally.",
        commonError: "Students very commonly forget the ± sign, only reporting one root, or make a sign error substituting a negative 'b' into -b.",
        examWeight: "high",
      },
      {
        id: "qe-discriminant", name: "The discriminant and nature of roots", order: 5,
        prerequisites: ["qe-quadratic-formula"],
        keyIdea: "b² - 4ac being positive, zero, or negative tells you whether the roots are two real, one repeated real, or no real roots at all — before even solving.",
        commonError: "Students often think a negative discriminant means 'no answer exists' in a vague sense, rather than specifically 'no real roots' — the equation still has complex roots, just not covered at this level.",
        examWeight: "high",
      },
    ],
  },
  {
    id: "cbse10-arithmetic-progressions",
    chapterName: "Arithmetic Progressions",
    subject: "Mathematics",
    grade: "10",
    concepts: [
      {
        id: "ap-definition", name: "Definition and common difference", order: 1,
        prerequisites: [],
        keyIdea: "An AP is a sequence where each term increases (or decreases) by the same fixed amount, called the common difference (d).",
        commonError: "Students sometimes compute d by subtracting terms in the wrong order (later minus earlier is correct — many accidentally reverse it, flipping the sign).",
        examWeight: "medium",
      },
      {
        id: "ap-nth-term", name: "The nth term formula", order: 2,
        prerequisites: ["ap-definition"],
        keyIdea: "The nth term is aₙ = a + (n-1)d, where a is the first term — this lets you find any term without listing them all out.",
        commonError: "Students very frequently use 'n' instead of '(n-1)' in the formula, which shifts every answer by exactly one common difference.",
        examWeight: "high",
      },
      {
        id: "ap-sum-n-terms", name: "Sum of the first n terms", order: 3,
        prerequisites: ["ap-nth-term"],
        keyIdea: "The sum Sₙ = n/2 × (2a + (n-1)d) — or equivalently n/2 × (first term + last term) — comes from pairing terms from opposite ends.",
        commonError: "When only the last term is given (not d), students often forget they can use Sₙ = n/2 × (a + last term) directly, and instead try to calculate d unnecessarily.",
        examWeight: "high",
      },
    ],
  },
];

// ─── Matching + prompt formatting ──────────────────────────────────────────

/** Fuzzy-matches a free-form topic string against the curated seed set.
 *  Returns null when nothing matches well enough — callers should fall
 *  back to ungrounded AI generation in that case, exactly as before this
 *  file existed. */
// BUG FIXED (found via direct testing, not inspection): originally used
// a raw token-count threshold of "> 0" — any single shared word was
// enough to count as a match. "newtons second law verification" matched
// "Verifying Ohm's Law" purely because both contain "law" — a real
// false positive that would have grounded the AI in the WRONG curated
// facts, worse than no grounding at all. Now requires at least 30% of
// the query's meaningful words to overlap, verified against 10 real
// cases (the false positive, several legitimate fuzzy phrasings, and
// genuinely out-of-scope queries) before landing on this threshold.
export function findConceptChapter(topic: string, subject?: string, grade?: string): ConceptChapter | null {
  if (sharedTokenize(topic).length === 0) return null;

  let best: ConceptChapter | null = null;
  let bestFraction = 0;

  for (const chapter of CONCEPT_KB) {
    if (subject && chapter.subject !== subject) continue;
    if (grade && chapter.grade !== grade) continue;
    const conceptNames = chapter.concepts.map(c => c.name).join(" ");
    const fraction = tokenOverlapFraction(topic, `${chapter.chapterName} ${conceptNames}`);
    if (fraction > bestFraction) { bestFraction = fraction; best = chapter; }
  }
  return bestFraction >= 0.3 ? best : null;
}

/** Formats a matched chapter as grounding context to inject into the
 *  dependency mind-map prompt — real prerequisite structure instead of
 *  the AI inventing one from scratch. */
export function formatConceptChapterForPrompt(chapter: ConceptChapter): string {
  const byId = new Map(chapter.concepts.map(c => [c.id, c.name]));
  return (
    `## Real prerequisite structure for "${chapter.chapterName}" (Class ${chapter.grade} ${chapter.subject}) — use this as the basis for your dependency graph, do not invent a different structure:\n\n` +
    chapter.concepts
      .sort((a, b) => a.order - b.order)
      .map(c => {
        const prereqNames = c.prerequisites.map(id => byId.get(id)).filter(Boolean);
        return (
          `${c.order}. ${c.name}\n` +
          `   What it is: ${c.keyIdea}\n` +
          `   Common error: ${c.commonError}\n` +
          (prereqNames.length > 0 ? `   Requires understanding first: ${prereqNames.join(", ")}` : `   No prerequisites within this chapter`)
        );
      })
      .join("\n\n")
  );
}
