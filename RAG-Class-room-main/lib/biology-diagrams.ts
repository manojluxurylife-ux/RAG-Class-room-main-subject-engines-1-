/**
 * Curated Biology diagram library — original, hand-authored SVG, not
 * AI-generated. This is a genuinely different shape of solution from
 * concept-kb.ts/lab-kb.ts (curated DATA grounding AI-written text) and
 * from the molecule/circuit visual types (AI supplies small parameters,
 * code draws the picture): cell and anatomical diagrams are
 * illustrative, not reducible to a few numbers the way a triangle or
 * circuit is. Asking the AI to generate SVG paths/coordinates directly
 * would mean trusting it to get real anatomy right stroke-by-stroke,
 * with no way to verify — a materially different risk than letting it
 * pick a difficulty level or a molecule's SMILES string.
 *
 * So the AI's job here is narrower and safer: SELECT which curated,
 * pre-verified diagram matches the current topic (a closed choice from
 * a known-good list — see BIOLOGY_DIAGRAM_IDS in content-generators.ts),
 * never draw anything itself. Worst case on a wrong selection is showing
 * a real, correct diagram that isn't quite the most relevant one — never
 * a diagram that's anatomically wrong.
 *
 * Seed set only — two, deliberately: plant cell and animal cell, the
 * single most common Class 8-10 CBSE Biology diagram (and a natural
 * compare/contrast pair — a very common exam question). Expanding this
 * is real, ongoing content-authoring work, same as concept-kb.ts/
 * lab-kb.ts — each new diagram needs to be exactly as carefully checked
 * for correctness as these two were.
 */

export interface BiologyDiagram {
  id:      string;
  name:    string;
  grade:   string;
  svg:     string;                                  // hand-authored, numbered parts
  parts:   { number: number; name: string }[];       // legend matching the numbers in the SVG
}

// Plant cell — cell wall (rigid, rectangular), cell membrane just inside
// it, a large central vacuole (the defining feature of a mature plant
// cell), chloroplasts, nucleus with a visible nucleolus, mitochondria.
const PLANT_CELL_SVG = `
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="360" height="260" rx="18" fill="none" stroke="#8a6d3b" stroke-width="6"/>
  <rect x="34" y="34" width="332" height="232" rx="12" fill="#2f3d2a" stroke="#5a7a4a" stroke-width="2"/>
  <ellipse cx="255" cy="185" rx="85" ry="58" fill="#3d6b7a" stroke="#6fb0c4" stroke-width="2"/>
  <circle cx="115" cy="95" r="42" fill="#5a3d6b" stroke="#8a6bb0" stroke-width="2"/>
  <circle cx="115" cy="95" r="14" fill="#3d2650" stroke="#8a6bb0" stroke-width="1.5"/>
  <ellipse cx="75" cy="195" rx="17" ry="10" fill="#3d7a3d" stroke="#6fb06f" stroke-width="1.5"/>
  <ellipse cx="145" cy="225" rx="17" ry="10" fill="#3d7a3d" stroke="#6fb06f" stroke-width="1.5"/>
  <ellipse cx="315" cy="95" rx="17" ry="10" fill="#3d7a3d" stroke="#6fb06f" stroke-width="1.5"/>
  <ellipse cx="195" cy="70" rx="14" ry="8" fill="#a15a4a" stroke="#c48a7a" stroke-width="1.5"/>
  <ellipse cx="95" cy="150" rx="14" ry="8" fill="#a15a4a" stroke="#c48a7a" stroke-width="1.5"/>
  <g font-family="sans-serif" font-size="13" font-weight="bold" fill="#f4f1e8">
    <circle cx="20" cy="20" r="11" fill="#8a6d3b"/><text x="20" y="24" text-anchor="middle">1</text>
    <circle cx="34" cy="45" r="11" fill="#5a7a4a"/><text x="34" y="49" text-anchor="middle">2</text>
    <circle cx="255" cy="185" r="11" fill="#3d6b7a"/><text x="255" y="189" text-anchor="middle">3</text>
    <circle cx="115" cy="95" r="11" fill="#5a3d6b"/><text x="115" y="99" text-anchor="middle">4</text>
    <circle cx="75" cy="195" r="11" fill="#3d7a3d"/><text x="75" y="199" text-anchor="middle">5</text>
    <circle cx="195" cy="70" r="11" fill="#a15a4a"/><text x="195" y="74" text-anchor="middle">6</text>
  </g>
</svg>`.trim();

// Animal cell — cell membrane ONLY (no cell wall, the key structural
// difference from a plant cell), irregular/rounder outline, nucleus
// with nucleolus, mitochondria, no chloroplasts and no large vacuole
// (deliberately — those are specifically plant-cell features, and
// showing them here would teach the exact confusion this diagram
// exists to prevent).
const ANIMAL_CELL_SVG = `
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <path d="M 200 25 C 300 20, 375 90, 370 165 C 378 240, 300 280, 205 278 C 110 282, 25 230, 28 155 C 22 80, 105 22, 200 25 Z"
        fill="#2f3d2a" stroke="#8a9d6a" stroke-width="4"/>
  <circle cx="190" cy="150" r="48" fill="#5a3d6b" stroke="#8a6bb0" stroke-width="2"/>
  <circle cx="190" cy="150" r="16" fill="#3d2650" stroke="#8a6bb0" stroke-width="1.5"/>
  <ellipse cx="95" cy="110" rx="16" ry="9" fill="#a15a4a" stroke="#c48a7a" stroke-width="1.5"/>
  <ellipse cx="290" cy="120" rx="16" ry="9" fill="#a15a4a" stroke="#c48a7a" stroke-width="1.5"/>
  <ellipse cx="270" cy="215" rx="16" ry="9" fill="#a15a4a" stroke="#c48a7a" stroke-width="1.5"/>
  <ellipse cx="110" cy="210" rx="16" ry="9" fill="#a15a4a" stroke="#c48a7a" stroke-width="1.5"/>
  <g font-family="sans-serif" font-size="13" font-weight="bold" fill="#f4f1e8">
    <circle cx="200" cy="25" r="11" fill="#8a9d6a"/><text x="200" y="29" text-anchor="middle">1</text>
    <circle cx="190" cy="150" r="11" fill="#5a3d6b"/><text x="190" y="154" text-anchor="middle">2</text>
    <circle cx="95" cy="110" r="11" fill="#a15a4a"/><text x="95" y="114" text-anchor="middle">3</text>
  </g>
</svg>`.trim();

export const BIOLOGY_DIAGRAMS: BiologyDiagram[] = [
  {
    id: "plant-cell", name: "Plant Cell", grade: "8",
    svg: PLANT_CELL_SVG,
    parts: [
      { number: 1, name: "Cell wall — rigid outer layer, only in plant cells" },
      { number: 2, name: "Cell membrane" },
      { number: 3, name: "Vacuole — large, fluid-filled, a defining feature of mature plant cells" },
      { number: 4, name: "Nucleus (with nucleolus)" },
      { number: 5, name: "Chloroplast — contains chlorophyll, site of photosynthesis" },
      { number: 6, name: "Mitochondrion — site of respiration" },
    ],
  },
  {
    id: "animal-cell", name: "Animal Cell", grade: "8",
    svg: ANIMAL_CELL_SVG,
    parts: [
      { number: 1, name: "Cell membrane — no cell wall, unlike a plant cell" },
      { number: 2, name: "Nucleus (with nucleolus)" },
      { number: 3, name: "Mitochondrion — site of respiration" },
    ],
  },
];

export function findBiologyDiagram(id: string): BiologyDiagram | null {
  return BIOLOGY_DIAGRAMS.find(d => d.id === id) || null;
}

// The exact closed set of valid ids — prompts list these explicitly so
// the AI picks from a known-good set rather than guessing an id that
// might not exist.
export const BIOLOGY_DIAGRAM_IDS = BIOLOGY_DIAGRAMS.map(d => d.id);
