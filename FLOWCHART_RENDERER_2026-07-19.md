# Flowchart Renderer — Mermaid Replaced (2026-07-19)

## Why

Mermaid was the heaviest dependency in the app by a wide margin:

- **89 MB of build-time weight** — the single biggest contributor to
  out-of-memory production builds on small Netlify/VPS build tiers.
- A **~1.4 MB gzipped runtime chunk** downloaded on demand by budget
  Android phones — and downloaded *often*, because `fallbackVisual()`
  emits a flowchart whenever the AI sends a malformed visual, making
  flowcharts the most-triggered visual type.
- Meanwhile the app only ever generates the simplest slice of mermaid's
  grammar: `flowchart TD` with labelled boxes and arrows. Sequence
  diagrams, gantt charts, class diagrams — all bundled, never used.

## What changed

**New: `lib/flowchart-renderer.ts`** (~250 lines, zero dependencies,
fully synchronous). Three pure functions:

- `parseMermaidFlowchart(syntax)` — parses a strict superset of what the
  prompts generate: `flowchart|graph TD|TB|LR|RL`; node shapes
  `A[rect]`, `A(round)`, `A((circle))`, `A{diamond}`; edges `A --> B`,
  `A --- B`, chains `A --> B --> C`, labels `A -->|yes| B` and
  `A -- no --> B`; multiple statements per line via `;`. Unsupported
  mermaid statements (`classDef`, `subgraph`, `style`…) are skipped;
  unparseable input throws.
- `layoutFlowchart(graph)` — longest-path layered ranking (cycle-safe),
  siblings ordered by parent position to reduce crossings, ranks
  centered, text wrapped to node-sized lines.
- `renderFlowchartSvg(syntax, theme)` — plain SVG with arrowhead
  markers, edge-label pills, and the exact chalkboard palette previously
  passed to `mermaid.initialize` (`#284134` fill, `#f4f1e8` text,
  `#e8a33d` border, `#b9c4ba` lines). All labels XML-escaped — verified
  by an injection test.

**Changed: `components/visuals/FlowchartVisual.tsx`** — same component
interface, same container styling, same friendly error on bad syntax,
but now renders synchronously via `useMemo` instead of async-importing
mermaid. **Nothing upstream changed**: the AI-facing `mermaidSyntax`
contract, `fallbackVisual()`, the visual schema, and every stored
material keep working identically.

**Removed:** `mermaid` from `package.json` / lockfile (zero remaining
references), plus its `@mermaid-js` leftovers in `node_modules`.

## Honest scope notes

- The renderer covers the flowchart subset the prompts request. If a
  future prompt starts asking for subgraphs or exotic arrow styles, the
  parser skips/throws rather than mis-rendering — extend
  `lib/flowchart-renderer.ts` then.
- First-load JS was never the problem (mermaid was already lazy); the
  wins are build memory, install size, and the on-demand chunk on
  student phones (~1.4 MB → a few KB inlined in the page bundle).
- Layout is layered-tree quality, not full dagre: fine for the linear
  and small branching charts lessons produce; a 30-node web of
  cross-links would look plainer than mermaid drew it. Node cap: 30.

## Verification

- `tests/flowchart-renderer.test.ts` — 8/8: parses `fallbackVisual()`
  output and the exact prompt example; shapes/chains/edge labels/LR;
  rank ordering; XML-escaping (script-injection test); malformed input
  throws; cycles terminate; Malayalam labels render.
- `tsc --noEmit` clean; `next build` clean, 74/74 pages.
- Existing suites still green: whiteboard 4/4, whiteboard-visuals 6/6,
  security 6/6.

## Related sizing facts (from the same review)

- **konva/react-konva** stays — it IS the whiteboard, ~2 MB on disk,
  ~50 KB runtime.
- **three.js** stays for now — used only by the `solid-3d` visual and
  already double-lazy (never in first-load JS). Optional future slim:
  replace the four solids (cone/cylinder/sphere/cube) with parametric
  2D SVG projections and drop three entirely.
