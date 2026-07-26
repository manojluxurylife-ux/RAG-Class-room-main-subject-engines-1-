/**
 * Original Virtual Lab grounding data — authored from scratch for this
 * app, not copied or adapted from any third-party source. Same
 * reasoning as lib/concept-kb.ts: OpenVidya's kb-data/lab-registry.json
 * has real, well-curated data (100 real NCERT experiments), but that
 * specific repo is AGPL-3.0 — incorporating its actual file would
 * obligate releasing this whole application's source under AGPL,
 * incompatible with a closed-source product. The experiments themselves
 * are standard, decades-old NCERT curriculum content (objective
 * scientific fact, not anyone's copyrightable expression) — what's
 * protected is OpenVidya's specific wording/JSON structure, not the
 * existence of "Class 10 students burn magnesium ribbon to observe a
 * combination reaction." This file independently re-authors real,
 * standard NCERT activities from genuine subject knowledge.
 *
 * DELIBERATE SCOPE: this grounds an AI *narration* of what a student
 * would observe and why — not a manipulable simulation. A student reads
 * a vivid, accurate walkthrough of the experiment; they don't drag a
 * slider or watch a rendered flame. Checked OpenMAIC's actual
 * "interactive" implementation before choosing this scope: it has the
 * AI author arbitrary HTML/JS live in a sandboxed iframe — real and
 * functional, but a genuine departure from this app's one consistent
 * safety principle across every other feature (diagrams, slides, quiz
 * formats): the AI supplies small checkable data, deterministic code
 * renders it, never AI-authored code executing directly. This file
 * keeps that principle intact — grounding data only, still text output.
 *
 * Seed set only — a handful of real, standard Class 9-10 CBSE Science
 * experiments. Expanding this is genuine, ongoing content-authoring
 * work, same as concept-kb.ts.
 */

import { tokenOverlapFraction } from "./fuzzy-match";

export interface LabExperiment {
  id:              string;
  experimentName:  string;
  subject:         "Physics" | "Chemistry" | "Biology";
  grade:           string;
  chapterName:     string;
  objective:       string;
  apparatus:       string[];
  procedure:       string[];       // ordered steps
  expectedObservation: string;     // what a student genuinely sees/measures
  scientificReason:string;         // WHY that observation happens — the actual teaching content
  safetyNotes?:    string;
  commonMistakes:  string[];
}

export const LAB_KB: LabExperiment[] = [
  {
    id: "lab-mg-combustion",
    experimentName: "Burning of magnesium ribbon in air",
    subject: "Chemistry", grade: "10",
    chapterName: "Chemical Reactions and Equations",
    objective: "Observe a combination reaction and identify the product formed.",
    apparatus: ["Magnesium ribbon (~5cm)", "Pair of tongs", "Spirit lamp or burner", "Sandpaper", "Watch glass"],
    procedure: [
      "Clean the magnesium ribbon with sandpaper to remove the dull oxide coating on its surface.",
      "Hold the cleaned ribbon with tongs, away from your face.",
      "Bring the tip of the ribbon into the burner flame.",
      "Once it catches, hold it over a watch glass and let it burn completely.",
      "Collect the white powder left behind in the watch glass.",
    ],
    expectedObservation: "The ribbon burns with a dazzling white flame, producing a white ash/powder.",
    scientificReason: "Magnesium combines directly with oxygen in the air to form magnesium oxide (2Mg + O₂ → 2MgO) — a combination reaction. The dazzling light is characteristic of burning magnesium and is intense enough that looking directly at it for too long isn't advisable.",
    safetyNotes: "Never look directly at the burning ribbon for an extended time — the light is intense enough to strain the eyes. Hold well away from the face and any flammable material.",
    commonMistakes: [
      "Skipping the sandpaper cleaning step — the existing oxide layer on unclean ribbon makes it harder to ignite and can make the reaction look weaker than it actually is.",
      "Assuming the white powder is unchanged magnesium — it's a genuinely new compound (magnesium oxide), not just \"burnt metal.\"",
    ],
  },
  {
    id: "lab-acid-base-litmus",
    experimentName: "Testing acidic and basic solutions with litmus paper",
    subject: "Chemistry", grade: "10",
    chapterName: "Acids, Bases and Salts",
    objective: "Distinguish acidic, basic, and neutral solutions using red and blue litmus paper.",
    apparatus: ["Red litmus paper", "Blue litmus paper", "Test tubes", "Dropper", "Sample solutions (e.g. dilute HCl, dilute NaOH, distilled water)"],
    procedure: [
      "Take a small amount of each test solution in a separate, clean test tube.",
      "Dip a strip of blue litmus paper into the first solution and observe any color change.",
      "Dip a strip of red litmus paper into the same solution and observe.",
      "Repeat for each solution, using fresh litmus strips each time.",
    ],
    expectedObservation: "Acidic solutions turn blue litmus red; basic solutions turn red litmus blue; a neutral solution changes neither.",
    scientificReason: "Litmus is a natural dye that changes color depending on the concentration of H⁺ and OH⁻ ions in a solution — acids release H⁺ ions, bases release OH⁻ ions, and litmus responds to which is present in excess.",
    safetyNotes: "Dilute acids and bases can still irritate skin/eyes — avoid direct contact and don't taste any solution to check it.",
    commonMistakes: [
      "Reusing the same litmus strip across different solutions, which can carry over enough residue to give a misleading result on the next test.",
      "Concluding a solution is neutral just because ONE litmus color didn't change — both red and blue litmus need to be tested to be sure.",
    ],
  },
  {
    id: "lab-ohms-law",
    experimentName: "Verifying Ohm's Law",
    subject: "Physics", grade: "10",
    chapterName: "Electricity",
    objective: "Verify that current through a resistor is directly proportional to the potential difference across it, at constant temperature.",
    apparatus: ["A resistor", "Battery/cell", "Ammeter", "Voltmeter", "Rheostat", "Plug key", "Connecting wires"],
    procedure: [
      "Connect the resistor, ammeter, battery, plug key, and rheostat in series to form a circuit.",
      "Connect the voltmeter in parallel across the resistor.",
      "Close the plug key and adjust the rheostat to get a small current reading.",
      "Note the ammeter (current) and voltmeter (potential difference) readings.",
      "Repeat for several different rheostat settings, recording each pair of readings.",
      "Plot a graph of potential difference (V) against current (I).",
    ],
    expectedObservation: "The V-I graph comes out as a straight line passing through the origin.",
    scientificReason: "Ohm's Law states V = IR — at constant temperature, the ratio of V to I for a given resistor stays constant (that constant IS the resistance), which is exactly why the graph is a straight line rather than a curve.",
    safetyNotes: "Always keep the rheostat at its maximum resistance position before closing the circuit, to avoid a sudden large current damaging the ammeter or components.",
    commonMistakes: [
      "Connecting the voltmeter in series instead of parallel — a voltmeter must always be connected in parallel across the component it's measuring.",
      "Not opening the key between readings, which can cause components to heat up and shift resistance slightly, curving the graph away from a straight line.",
    ],
  },
  {
    id: "lab-photosynthesis-starch",
    experimentName: "Testing a leaf for the presence of starch",
    subject: "Biology", grade: "10",
    chapterName: "Life Processes",
    objective: "Show that starch is produced in a leaf as a result of photosynthesis.",
    apparatus: ["A destarched potted plant kept in sunlight for a few hours", "Ethanol", "Iodine solution", "Beaker", "Water bath / burner", "Petri dish"],
    procedure: [
      "Pluck a leaf from the plant that's been in sunlight for several hours.",
      "Boil the leaf in water for a minute to soften it.",
      "Boil the softened leaf in ethanol (using a water bath, since ethanol is flammable) until it loses its green color.",
      "Dip the decolorized leaf in warm water to soften it again.",
      "Spread the leaf in a petri dish and add a few drops of iodine solution.",
      "Observe the color change.",
    ],
    expectedObservation: "The parts of the leaf that were exposed to sunlight turn blue-black with iodine; if part of the leaf had been covered/shaded beforehand, that part stays the original iodine-brown color.",
    scientificReason: "Iodine turns blue-black specifically in the presence of starch. Starch is the stored form of the glucose a leaf produces during photosynthesis — so a blue-black color is direct evidence photosynthesis happened in that part of the leaf, and no color change shows it didn't (e.g. in a shaded area).",
    safetyNotes: "Ethanol is flammable — always heat it using a water bath, never a direct open flame.",
    commonMistakes: [
      "Not destarching the plant beforehand (keeping it in the dark for 24-48 hours first) — a leaf with old, pre-existing starch will show color everywhere regardless of the actual experiment, making the result meaningless.",
      "Under-boiling in ethanol, leaving too much green chlorophyll behind, which can mask the true iodine color change.",
    ],
  },
];

// ─── Matching + prompt formatting ──────────────────────────────────────────

/** Fuzzy-matches a free-form experiment/topic name against the curated
 *  seed set. Returns null when nothing matches well enough — callers
 *  fall back to a clearly-caveated, ungrounded narration in that case.
 *
 *  Uses the same fraction-based threshold as concept-kb.ts's
 *  findConceptChapter() — fixed there after direct testing revealed a
 *  raw ">0 shared words" threshold produces real false positives (e.g.
 *  "newtons second law verification" matching "Verifying Ohm's Law"
 *  purely via the shared word "law"). Applied here from the start,
 *  verified against the same real test cases. */
export function findLabExperiment(query: string, subject?: string, grade?: string): LabExperiment | null {
  let best: LabExperiment | null = null;
  let bestFraction = 0;
  for (const lab of LAB_KB) {
    if (subject && lab.subject !== subject) continue;
    if (grade && lab.grade !== grade) continue;
    const fraction = tokenOverlapFraction(query, `${lab.experimentName} ${lab.chapterName}`);
    if (fraction > bestFraction) { bestFraction = fraction; best = lab; }
  }
  return bestFraction >= 0.3 ? best : null;
}

/** Formats a matched experiment as grounding context for the narration prompt. */
export function formatLabForPrompt(lab: LabExperiment): string {
  return (
    `## Real experiment data for "${lab.experimentName}" (Class ${lab.grade} ${lab.subject}) — base your narration on these actual facts, do not invent different apparatus/results:\n\n` +
    `Objective: ${lab.objective}\n` +
    `Apparatus: ${lab.apparatus.join(", ")}\n` +
    `Procedure:\n${lab.procedure.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n` +
    `What actually happens: ${lab.expectedObservation}\n` +
    `Why it happens: ${lab.scientificReason}\n` +
    (lab.safetyNotes ? `Safety note: ${lab.safetyNotes}\n` : "") +
    `Common mistakes students make: ${lab.commonMistakes.join(" | ")}`
  );
}
