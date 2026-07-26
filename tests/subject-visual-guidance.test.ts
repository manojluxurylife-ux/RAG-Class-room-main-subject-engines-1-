/**
 * Tests for lib/visual-generation.ts's subjectVisualGuidance() — steers
 * generation toward a subject's natural visual library (Physics ->
 * wave/ray-diagram/force-diagram, Chemistry -> atom/chem-equation,
 * etc.) instead of leaving the model to infer purely from content which
 * of ~19 renderer types fits best.
 *
 * Run with: npx tsx --test tests/subject-visual-guidance.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { subjectVisualGuidance } from "../lib/visual-generation";

test("returns Physics-specific guidance for a Physics textbook", () => {
  const g = subjectVisualGuidance("Physics");
  assert.ok(g.includes("wave"));
  assert.ok(g.includes("ray-diagram"));
  assert.ok(g.includes("force-diagram"));
  assert.ok(g.includes("Physics textbook"));
});

test("returns Chemistry-specific guidance, not Physics types", () => {
  const g = subjectVisualGuidance("Chemistry");
  assert.ok(g.includes("atom"));
  assert.ok(g.includes("chem-equation"));
  assert.ok(!g.includes("ray-diagram"), "should not suggest Physics-only renderers for Chemistry");
});

test("returns Biology guidance", () => {
  const g = subjectVisualGuidance("Biology");
  assert.ok(g.includes("punnett"));
  assert.ok(g.includes("biology-diagram"));
});

test("returns Social Science guidance including india-map and timeline", () => {
  const g = subjectVisualGuidance("Social Science");
  assert.ok(g.includes("india-map"));
  assert.ok(g.includes("timeline"));
});

test("returns Computer Science guidance", () => {
  const g = subjectVisualGuidance("Computer Science");
  assert.ok(g.includes("logic-circuit"));
  assert.ok(g.includes("data-structure"));
});

test("lookup is case-insensitive on the subject, while the displayed subject name keeps its original casing", () => {
  const upper = subjectVisualGuidance("PHYSICS");
  const lower = subjectVisualGuidance("physics");
  const mixed = subjectVisualGuidance("Physics");
  assert.ok(upper.includes("wave") && lower.includes("wave") && mixed.includes("wave"), "same guidance content regardless of casing");
  assert.ok(upper.includes("PHYSICS textbook"), "original casing preserved in the displayed subject name");
  assert.ok(mixed.includes("Physics textbook"));
});

test("returns an empty string (no guidance) for an unknown or missing subject, not an error", () => {
  assert.equal(subjectVisualGuidance(undefined), "");
  assert.equal(subjectVisualGuidance(null), "");
  assert.equal(subjectVisualGuidance(""), "");
  assert.equal(subjectVisualGuidance("Underwater Basket Weaving"), "");
});

test("always ends by allowing any other validated type — a hint, not a restriction", () => {
  const g = subjectVisualGuidance("Mathematics");
  assert.ok(/any other validated visual type/i.test(g));
});
