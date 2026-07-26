/**
 * Regression tests for the "plain-text lessons / empty whiteboard" fix.
 * Run with:  npx tsx --test tests/whiteboard-visuals.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

test("empty commands array falls back to a REAL board, not 1-2 lines", async () => {
  const { normalizeWhiteboardPlan } = await import("../lib/whiteboard-commands");
  // The exact failure case: model copied the old template's "commands":[]
  const plan = normalizeWhiteboardPlan(
    { version: 1, autoplay: true, commands: [] },
    ["Photosynthesis"],
    "Plants make food using sunlight. Chlorophyll absorbs light energy. Carbon dioxide enters through stomata. Water comes from the roots. The products are glucose and oxygen.",
  );
  const writes = plan.commands.filter(c => c.action === "write");
  assert.ok(writes.length >= 4, `expected a taught board, got ${writes.length} write commands`);
});

test("long prose board line is split into teachable sentence lines", async () => {
  const { planFromBoardLines } = await import("../lib/whiteboard-commands");
  const longLine = "Force is a push or a pull. It can change the speed of an object. It can also change the direction of motion. Force is measured in newtons.";
  const plan = planFromBoardLines([longLine]);
  const writes = plan.commands.filter(c => c.action === "write");
  assert.ok(writes.length >= 3, `expected split lines, got ${writes.length}`);
  for (const w of writes) {
    assert.ok((w as any).text.length <= 200, "no 500-char blobs on the board");
  }
});

test("valid AI whiteboard plans still pass through untouched in shape", async () => {
  const { normalizeWhiteboardPlan } = await import("../lib/whiteboard-commands");
  const plan = normalizeWhiteboardPlan({
    version: 1, autoplay: true, commands: [
      { id: "eq1", action: "write", text: "2x + 3 = 11", durationMs: 1500 },
      { id: "eq2", action: "write", text: "2x = 8", durationMs: 1500 },
      { id: "a1", action: "arrow", from: "eq1", to: "eq2", durationMs: 700 },
      { id: "eq3", action: "write", text: "x = 4", durationMs: 1200 },
      { id: "m1", action: "circle", target: "eq3", durationMs: 700 },
    ],
  }, ["fallback line"]);
  assert.equal(plan.commands.filter(c => c.action === "write").length, 3);
  assert.ok(plan.commands.some(c => c.action === "arrow"));
  assert.ok(plan.commands.some(c => c.action === "circle"));
});

test("prompt instructions: no empty-array template, populated example instead", async () => {
  const { WHITEBOARD_COMMAND_JSON_INSTRUCTION } = await import("../lib/whiteboard-commands");
  assert.ok(!WHITEBOARD_COMMAND_JSON_INSTRUCTION.includes('"commands":[]'), "template must never model an empty commands array");
  assert.ok(WHITEBOARD_COMMAND_JSON_INSTRUCTION.includes("NEVER return an empty commands array"));
  assert.ok(WHITEBOARD_COMMAND_JSON_INSTRUCTION.includes('"action":"write"'), "example must show real commands");
});

test("lesson visual instruction demands visuals for visualizable content", async () => {
  const vg = await import("../lib/visual-generation");
  assert.ok(vg.LESSON_VISUAL_INSTRUCTION.includes("EVERY scene whose textbook content is visualizable"));
  assert.ok(vg.LESSON_VISUAL_INSTRUCTION.includes('"type":"graph"'), "schema list must be embedded");
  // materials keep the conservative rule
  assert.ok(vg.VISUAL_JSON_INSTRUCTION.includes("At most 1-2"));
});

test("malformed visual still becomes a renderable fallback; absent stays absent", async () => {
  const { normalizeVisual } = await import("../lib/visual-generation");
  assert.equal(normalizeVisual(undefined, "T"), undefined);
  assert.equal(normalizeVisual(null, "T"), undefined);
  const repaired = normalizeVisual({ nonsense: true }, "Water cycle", ["Evaporation", "Condensation"]);
  assert.equal((repaired as any)?.type, "flowchart");
});

test("speech chunking: fast first chunk, danda support, merge tiny fragments", async () => {
  const { chunkForSpeech } = await import("../lib/web-speech");
  const long = "Photosynthesis is the process by which green plants make their own food. It happens inside the chloroplasts of the leaf cells. Sunlight provides the energy for this process. Carbon dioxide enters through the stomata. Water is absorbed by the roots and travels up the stem.";
  const chunks = chunkForSpeech(long);
  assert.ok(chunks.length >= 3, "long narration must split into several chunks");
  assert.ok(chunks[0].length < 260, "first chunk must be short enough to start fast");
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), long.replace(/\s+/g, " "), "no words lost");
  const ml = chunkForSpeech("ഇത് ആദ്യ വാക്യം ആണ്। ഇത് രണ്ടാമത്തെ വാക്യം ആണ്। ഇത് മൂന്നാമത്തേതും അല്പം കൂടി നീളമുള്ളതും ആയ വാക്യം ആണ്।");
  assert.ok(ml.length >= 2, "danda (।) must split Malayalam/Hindi narration");
  assert.deepEqual(chunkForSpeech("Short."), ["Short."]);
  assert.deepEqual(chunkForSpeech(""), []);
});
