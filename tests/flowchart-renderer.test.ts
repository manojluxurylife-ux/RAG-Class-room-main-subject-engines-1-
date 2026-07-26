/**
 * Tests for lib/flowchart-renderer — the mermaid replacement.
 * Run with:  npx tsx --test tests/flowchart-renderer.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMermaidFlowchart, layoutFlowchart, renderFlowchartSvg } from "../lib/flowchart-renderer";
import { fallbackVisual } from "../lib/visual-generation";

test("parses the exact syntax fallbackVisual() generates", () => {
  const visual = fallbackVisual("Water cycle", ["Evaporation", "Condensation", "Rain falls"]);
  const g = parseMermaidFlowchart((visual as any).mermaidSyntax);
  assert.equal(g.direction, "TD");
  assert.equal(g.nodes.length, 4);
  assert.equal(g.edges.length, 3);
  assert.equal(g.nodes[0].label, "Water cycle");
});

test("parses the exact example shown in the AI prompt", () => {
  const g = parseMermaidFlowchart("flowchart TD\nA[Start] --> B[Next step]");
  assert.equal(g.nodes.length, 2);
  assert.deepEqual(g.edges, [{ from: "A", to: "B" }]);
});

test("shapes, chains, edge labels, LR, semicolons", () => {
  const g = parseMermaidFlowchart(
    'graph LR; A[Box] --> B(Round) --> C((Circle)); B -->|yes| D{Even?}; D -- no --> A',
  );
  assert.equal(g.direction, "LR");
  const shapes = Object.fromEntries(g.nodes.map(n => [n.id, n.shape]));
  assert.deepEqual(shapes, { A: "rect", B: "round", C: "circle", D: "diamond" });
  assert.deepEqual(g.edges.find(e => e.to === "D" && e.from === "B")?.label, "yes");
  assert.deepEqual(g.edges.find(e => e.from === "D")?.label, "no");
  assert.equal(g.edges.length, 4);
});

test("layout ranks flow top-down without overlaps on the main axis", () => {
  const g = parseMermaidFlowchart("flowchart TD\nA[One] --> B[Two]\nA --> C[Three]\nB --> D[Four]\nC --> D");
  const { nodes, width, height } = layoutFlowchart(g);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  assert.ok(byId.A.y < byId.B.y && byId.B.y < byId.D.y, "ranks must descend");
  assert.equal(byId.B.y, byId.C.y, "siblings share a rank");
  assert.ok(width > 0 && height > 0);
});

test("SVG output: nodes, arrowheads, escaped labels — no script injection", () => {
  const svg = renderFlowchartSvg('flowchart TD\nA["<script>alert(1)</script>"] --> B[Safe & sound]');
  assert.ok(svg.startsWith("<svg"));
  assert.ok(!svg.includes("<script>"), "labels must be XML-escaped");
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("Safe &amp; sound"));
  assert.ok(svg.includes("marker-end"), "edges need arrowheads");
});

test("malformed syntax throws (component shows its friendly error)", () => {
  assert.throws(() => parseMermaidFlowchart("this is not a flowchart -->"));
  assert.throws(() => parseMermaidFlowchart(""));
});

test("cycles do not hang or crash", () => {
  const svg = renderFlowchartSvg("flowchart TD\nA[Sunrise] --> B[Day] --> C[Night] --> A");
  assert.ok(svg.includes("Sunrise") && svg.includes("Night"));
});

test("Malayalam labels render", () => {
  const svg = renderFlowchartSvg("flowchart TD\nA[ജലചക്രം] --> B[ബാഷ്പീകരണം]");
  assert.ok(svg.includes("ജലചക്രം") && svg.includes("ബാഷ്പീകരണം"));
});
