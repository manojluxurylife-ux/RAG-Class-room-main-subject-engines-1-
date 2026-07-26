# Subject Visuals — Volumes 3-8 (2026-07-19)

Extends the visual layer beyond Maths to Physics, Chemistry, Biology,
Geography, Language Learning, and History/Civics/CS for students up to
Standard 12.

## Build-vs-adopt decision

Searched GitHub/npm first, per the brief. Findings: no maintained
lightweight library exists for school-level ray-optics, Bohr atoms,
Punnett squares, free-body diagrams, timelines, or logic-gate diagrams —
the options are either heavyweight scientific tooling or abandoned
5-star repos (same conclusion the circuit renderer reached earlier).
**One genuine find was adopted: `@svg-maps/india` (npm, ~380 KB)** —
pure SVG path data for all 36 states/UTs, no framework attached. Its
data is consumed by our own renderer, imported on demand so it never
rides in the page bundle.

Everything else is built in-house in `lib/subject-visuals.ts`, following
the flowchart-renderer pattern: pure functions returning SVG strings —
zero dependencies, synchronous, unit-testable, a few KB total, all in
the chalkboard palette.

## New visual types (AI outputs parameters; renderer draws)

| Volume | Type | AI supplies |
|---|---|---|
| 3 Physics | `wave` | cycles, labels — amplitude/wavelength markers drawn |
| 3 Physics | `ray-diagram` | element (convex/concave lens/mirror), f, u — image computed from the lens/mirror formula, principal rays drawn, nature stated (real/virtual, erect/inverted, magnified/diminished) |
| 3 Physics | `force-diagram` | forces with label/direction/magnitude — free-body arrows scaled by magnitude |
| 4 Chemistry | `atom` | element + Z (≤20) or explicit shells — Bohr model with K/L/M/N rings |
| 4 Chemistry | `chem-equation` | plain ASCII equation ("2H2 + O2 -> 2H2O", `<->` for ⇌) — rendered with proper subscripts |
| 5 Biology | `punnett` | two parent gamete pairs — 2×2 monohybrid cross grid |
| 6 Geography | `india-map` | state names/ids to highlight — full India map, highlighted states in amber |
| 8 History | `timeline` | 2–10 events (year + label) — alternating horizontal timeline |
| 8 CS | `logic-circuit` | inputs + gate netlist (AND/OR/NOT/NAND/NOR/XOR/XNOR) — dependency-ranked layout, standard gate shapes, wires, output arrow |
| 8 CS | `data-structure` | kind (array/stack/queue/linked-list/binary-tree) + values |

Existing types already covering the volumes: `circuit`, `graph` (Physics),
`molecule` (Chemistry), `biology-diagram` (Biology), `bar-chart` +
`flowchart` (Geography data/cycles), `flowchart` (Civics org charts,
Language sentence/grammar trees — and the Malayalam alphabet stroke
board already lives in the classroom for Volume 7).

## Wiring

- `lib/visual-schema.ts` — 10 new interfaces, union members, and
  validation cases (malformed AI output still degrades to "no diagram").
- `lib/visual-generation.ts` — `VISUAL_SCHEMA_LIST` now teaches the AI
  every new type with a one-line example each; both the conservative
  material instruction and the lesson-strength instruction inherit them
  automatically.
- `components/visuals/SubjectVisual.tsx` — one thin dispatcher (lazy via
  `next/dynamic` like the other visual components); india-map imports
  its path data on demand.
- `components/visuals/DiagramRenderer.tsx` — routes the 10 new types.

## Honest scope notes

- `ray-diagram` uses magnitude-based textbook conventions and the two
  standard principal rays — correct for every Class 10/12 case (u vs f
  on either side), but it is a teaching construction, not a general
  optics simulator.
- `atom` follows the simple 2-8-8-2 filling taught up to Z=20; heavier
  elements need explicit `shells` from the AI (the prompt says so).
- `india-map` is states-level. District-level Kerala maps would need
  another data source (datameet/maps has district GeoJSON but requires a
  projection step — a clean future addition if you want it).
- `logic-circuit` caps at 12 gates with orthogonal wiring — right for
  textbook exercises, not a schematic editor.
- Biology beyond genetics still routes through the curated
  `biology-diagram` set by design (see that type's schema comment: a
  wrong pick shows a correct-but-less-relevant diagram, never wrong
  anatomy). Extending the curated set is content work, not plumbing.

## Verification

- `tests/subject-visuals.test.ts` — 12/12, including physics correctness
  (convex lens u>f → real inverted at v=uf/(u-f); u<f → virtual
  magnified; concave → virtual diminished), Bohr shell filling for
  Na/Cl/Ca, Punnett genotype counts, map highlighting, timeline caps,
  gate ranking, XML-escaping of labels.
- All prior suites green: whiteboard 4/4, whiteboard-visuals 6/6,
  flowchart 8/8, security 6/6. `tsc --noEmit` clean; `next build`
  clean, 74/74 pages.
