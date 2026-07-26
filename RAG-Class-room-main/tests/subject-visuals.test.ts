/**
 * Tests for lib/subject-visuals.ts — Volumes 3-8 subject renderers.
 * Run with:  npx tsx --test tests/subject-visuals.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderWave, renderRayDiagram, renderForceDiagram, renderAtom, shellsForZ,
  renderChemEquation, renderPunnett, renderIndiaMap, renderTimeline,
  renderLogicCircuit, renderDataStructure,
} from "../lib/subject-visuals";
import { isValidVisual } from "../lib/visual-schema";

const isSvg = (s: string) => s.startsWith("<svg") && s.endsWith("</svg>");

test("Physics: wave renders with amplitude and wavelength markers", () => {
  const svg = renderWave({ cycles: 3, caption: "Sound wave" });
  assert.ok(isSvg(svg));
  assert.ok(svg.includes("amplitude") && svg.includes("wavelength"));
  assert.ok(svg.includes("Sound wave"));
});

test("Physics: convex lens u>f gives a real inverted image; u<f virtual", () => {
  const real = renderRayDiagram({ element: "convex-lens", focalLength: 10, objectDistance: 25 });
  assert.ok(real.includes("Real, inverted"));
  // v = uf/(u-f) = 250/15 ≈ 16.7
  assert.ok(real.includes("v=16.7cm"));
  const virt = renderRayDiagram({ element: "convex-lens", focalLength: 10, objectDistance: 6 });
  assert.ok(virt.includes("Virtual, erect, magnified"));
  const concave = renderRayDiagram({ element: "concave-lens", focalLength: 10, objectDistance: 20 });
  assert.ok(concave.includes("Virtual, erect, diminished"));
});

test("Physics: force diagram draws one labelled arrow per force", () => {
  const svg = renderForceDiagram({ body: "Block", forces: [
    { label: "W", direction: "down", magnitude: 50 },
    { label: "N", direction: "up", magnitude: 50 },
    { label: "F", direction: 0, magnitude: 20 },
  ]});
  assert.ok(isSvg(svg));
  assert.ok(svg.includes("W = 50 N") && svg.includes("N = 50 N") && svg.includes("F = 20 N"));
});

test("Chemistry: Bohr shells follow 2,8,8,2 filling and render", () => {
  assert.deepEqual(shellsForZ(11), [2, 8, 1]);   // sodium
  assert.deepEqual(shellsForZ(17), [2, 8, 7]);   // chlorine
  assert.deepEqual(shellsForZ(20), [2, 8, 8, 2]); // calcium
  const svg = renderAtom({ element: "Na", atomicNumber: 11 });
  assert.ok(svg.includes("2, 8, 1") && svg.includes(">Na<"));
});

test("Chemistry: equation renders subscripts and arrow", () => {
  const svg = renderChemEquation({ equation: "2H2 + O2 -> 2H2O" });
  assert.ok(isSvg(svg));
  assert.ok(svg.includes("→"));
  assert.ok(svg.includes('dy="5"'), "digit subscripts must drop below baseline");
  const eq = renderChemEquation({ equation: "N2 + 3H2 <-> 2NH3" });
  assert.ok(eq.includes("⇌"), "reversible arrow");
});

test("Biology: Punnett square shows all four genotype combinations", () => {
  const svg = renderPunnett({ parent1: ["T", "t"], parent2: ["T", "t"] });
  assert.ok(isSvg(svg));
  assert.ok(svg.includes("TT") && svg.includes("tt"));
  assert.equal((svg.match(/Tt/g) || []).length, 2, "heterozygous appears twice");
});

test("Geography: India map highlights by state name or id", () => {
  const data = {
    viewBox: "0 0 612 696",
    locations: [
      { id: "kl", name: "Kerala", path: "M 0 0 L 10 0 L 10 10 Z" },
      { id: "tn", name: "Tamil Nadu", path: "M 20 0 L 30 0 L 30 10 Z" },
    ],
  };
  const svg = renderIndiaMap(data, { highlight: ["Kerala"], caption: "Kerala highlighted" });
  assert.ok(isSvg(svg));
  const kerala = svg.split("<path")[1];
  assert.ok(kerala.includes('#e8a33d'), "highlighted state uses the amber fill");
  assert.ok(svg.includes("<title>Tamil Nadu</title>"));
});

test("History: timeline alternates labels and caps at 10 events", () => {
  const events = Array.from({ length: 14 }, (_, i) => ({ year: 1900 + i * 5, label: `Event ${i + 1}` }));
  const svg = renderTimeline({ title: "Modern India", events });
  assert.ok(isSvg(svg));
  assert.ok(svg.includes("Event 10") && !svg.includes("Event 11"));
  assert.ok(svg.includes("Modern India"));
});

test("CS: logic circuit ranks gates by dependency and marks output", () => {
  const svg = renderLogicCircuit({
    inputs: ["A", "B", "C"],
    gates: [
      { id: "G1", gate: "AND", inputs: ["A", "B"] },
      { id: "G2", gate: "OR", inputs: ["G1", "C"] },
      { id: "G3", gate: "NOT", inputs: ["G2"] },
    ],
    output: "G3",
  });
  assert.ok(isSvg(svg));
  assert.ok(svg.includes("AND") && svg.includes("OR") && svg.includes("NOT"));
  assert.ok(svg.includes(">Y<"), "output label");
});

test("CS: data structures render array indices, stack TOP, list null", () => {
  assert.ok(renderDataStructure({ kind: "array", values: [10, 20, 30] }).includes("[2]"));
  assert.ok(renderDataStructure({ kind: "stack", values: [1, 2, 3] }).includes("TOP"));
  assert.ok(renderDataStructure({ kind: "linked-list", values: [5, 6] }).includes("null"));
  assert.ok(renderDataStructure({ kind: "binary-tree", values: [1, 2, 3, 4, 5] }).startsWith("<svg"));
});

test("schema validation accepts good specs, rejects malformed ones", () => {
  assert.ok(isValidVisual({ type: "ray-diagram", element: "convex-lens", focalLength: 10, objectDistance: 25 }));
  assert.ok(!isValidVisual({ type: "ray-diagram", element: "flat-mirror", focalLength: 10, objectDistance: 25 }));
  assert.ok(isValidVisual({ type: "punnett", parent1: ["T", "t"], parent2: ["T", "t"] }));
  assert.ok(!isValidVisual({ type: "punnett", parent1: ["T"], parent2: ["T", "t"] }));
  assert.ok(isValidVisual({ type: "timeline", events: [{ year: 1947, label: "Independence" }] }));
  assert.ok(!isValidVisual({ type: "timeline", events: [] }));
  assert.ok(isValidVisual({ type: "logic-circuit", inputs: ["A"], gates: [{ id: "G1", gate: "NOT", inputs: ["A"] }] }));
  assert.ok(!isValidVisual({ type: "data-structure", kind: "hashmap", values: [1] }));
});

test("labels are XML-escaped everywhere user text flows in", () => {
  const svg = renderTimeline({ events: [{ year: 1947, label: '<script>alert(1)</script>' }] });
  assert.ok(!svg.includes("<script>"));
  const f = renderForceDiagram({ forces: [{ label: 'A & "B"', direction: "up" }] });
  assert.ok(f.includes("A &amp; &quot;B&quot;"));
});
