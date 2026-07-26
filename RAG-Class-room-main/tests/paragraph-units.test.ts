/**
 * Tests for lib/paragraph-units.ts — turns a whole-page narration block
 * into paragraph-sized teaching units, fixing "the browser reads the
 * complete contents of the page" distraction.
 *
 * Run with: npx tsx --test tests/paragraph-units.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoParagraphs, buildTeachingUnits } from "../lib/paragraph-units";

test("splitIntoParagraphs uses real blank-line breaks when present", () => {
  const text = "First paragraph about photosynthesis in plants.\n\nSecond paragraph about chlorophyll and sunlight.\n\nThird paragraph about oxygen release.";
  const paragraphs = splitIntoParagraphs(text);
  assert.equal(paragraphs.length, 3);
  assert.ok(paragraphs[0].includes("photosynthesis"));
  assert.ok(paragraphs[2].includes("oxygen"));
});

test("splitIntoParagraphs falls back to sentence clustering for OCR text with no paragraph breaks", () => {
  const text = "Plants make food using sunlight. This process is called photosynthesis. Chlorophyll absorbs light energy. Carbon dioxide enters through small pores. Water travels up from the roots. The products are glucose and oxygen. Oxygen is released into the air.";
  const paragraphs = splitIntoParagraphs(text);
  assert.ok(paragraphs.length >= 2, `expected multiple clustered paragraphs, got ${paragraphs.length}`);
  assert.ok(paragraphs.length <= 6, "must respect the paragraph cap");
});

test("splitIntoParagraphs does not split on abbreviations or decimals", () => {
  const text = "The reaction uses 2.5 grams of salt. Dr. Menon explained the process. e.g. sodium chloride dissolves easily.";
  const paragraphs = splitIntoParagraphs(text);
  const joined = paragraphs.join(" ");
  assert.ok(!joined.includes("2 .5") && joined.includes("2.5"), "decimal must stay intact");
});

test("a single short paragraph does not get shredded into fragments", () => {
  const paragraphs = splitIntoParagraphs("Water is essential for life.");
  assert.equal(paragraphs.length, 1);
});

test("empty or whitespace-only text returns no paragraphs", () => {
  assert.deepEqual(splitIntoParagraphs(""), []);
  assert.deepEqual(splitIntoParagraphs("   \n\n  "), []);
});

test("buildTeachingUnits pairs each source paragraph with its own explanation and solve chunk", () => {
  const source = "Plants absorb sunlight through their leaves.\n\nThey convert carbon dioxide and water into glucose.\n\nOxygen is released as a byproduct of this process.";
  const explanation = "Sunlight gives plants the energy they need. The green pigment chlorophyll captures this light. Water and carbon dioxide combine using that energy. Glucose is the sugar the plant uses for food. Oxygen escapes through tiny pores called stomata.";
  const solve = "Example: a plant with more sunlight makes more food faster.";
  const units = buildTeachingUnits(source, explanation, solve);
  assert.equal(units.length, 3);
  assert.ok(units[0].source.includes("sunlight"));
  assert.ok(units[0].explanation.length > 0);
  assert.ok(units.some(u => u.solve.length > 0));
});

test("buildTeachingUnits returns empty (signal to use whole-block fallback) when the source has no real paragraph structure", () => {
  const units = buildTeachingUnits("Just one short line.", "A brief note.", "");
  assert.deepEqual(units, []);
});

test("buildTeachingUnits never throws on missing explanation/solve text", () => {
  const source = "First idea about the water cycle.\n\nSecond idea about evaporation.\n\nThird idea about condensation.";
  assert.doesNotThrow(() => buildTeachingUnits(source, "", ""));
  const units = buildTeachingUnits(source, "", "");
  assert.equal(units.length, 3);
  units.forEach(u => { assert.equal(u.explanation, ""); assert.equal(u.solve, ""); });
});

test("distributed explanation chunks preserve original sentence order across the whole text", () => {
  const source = "Para one.\n\nPara two.\n\nPara three.\n\nPara four.";
  const explanation = "First point. Second point. Third point. Fourth point. Fifth point. Sixth point. Seventh point. Eighth point.";
  const units = buildTeachingUnits(source, explanation, "");
  const rebuilt = units.map(u => u.explanation).join(" ");
  assert.equal(rebuilt.replace(/\s+/g, " ").trim(), explanation);
});
