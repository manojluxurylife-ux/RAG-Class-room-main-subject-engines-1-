/**
 * Tests for the per-line whiteboard narration design — the schema and
 * prompt-level foundation for synchronized "teacher speaks while
 * writing" playback (see lib/whiteboard-commands.ts's design comment
 * on WhiteboardCommand.narration for the full rationale).
 *
 * Run with: npx tsx --test tests/whiteboard-narration.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isWhiteboardCommand, normalizeWhiteboardPlan, planFromBoardLines,
  toNarratedSegments, WHITEBOARD_COMMAND_JSON_INSTRUCTION,
} from "../lib/whiteboard-commands";

test("isWhiteboardCommand accepts a write command with narration", () => {
  assert.ok(isWhiteboardCommand({ action: "write", text: "2x + 3 = 11", narration: "So we start with two x plus three equals eleven." }));
});

test("isWhiteboardCommand still accepts a write command with NO narration (backward compatible)", () => {
  assert.ok(isWhiteboardCommand({ action: "write", text: "2x + 3 = 11" }));
});

test("isWhiteboardCommand rejects a narration that isn't a string or is absurdly long", () => {
  assert.equal(isWhiteboardCommand({ action: "write", text: "x", narration: 123 as any }), false);
  assert.equal(isWhiteboardCommand({ action: "write", text: "x", narration: "a".repeat(1300) }), false);
});

test("normalizeWhiteboardPlan preserves and trims narration on valid write commands", () => {
  const plan = normalizeWhiteboardPlan({
    version: 1, autoplay: true,
    commands: [{ id: "l1", action: "write", text: "2x + 3 = 11", narration: "  So we start with two x plus three equals eleven.  ", durationMs: 1500 }],
  }, ["fallback"]);
  const write = plan.commands.find(c => c.action === "write") as any;
  assert.equal(write.narration, "So we start with two x plus three equals eleven.");
});

test("normalizeWhiteboardPlan does NOT invent narration for AI output that omits it", () => {
  // Important: a scene genuinely missing narration on some/all lines
  // must stay that way, so playback can correctly detect "this
  // material predates synchronized narration" and fall back to
  // block-narration mode for that scene, rather than silently
  // fabricating text nobody asked the model for.
  const plan = normalizeWhiteboardPlan({
    version: 1, autoplay: true,
    commands: [{ id: "l1", action: "write", text: "2x + 3 = 11", durationMs: 1500 }],
  }, ["fallback"]);
  const write = plan.commands.find(c => c.action === "write") as any;
  assert.equal(write.narration, undefined);
});

test("planFromBoardLines (the emergency fallback generator) DOES synthesize narration, so even the fallback path benefits from synchronized playback", () => {
  const plan = planFromBoardLines(["Force equals mass times acceleration."]);
  const write = plan.commands.find(c => c.action === "write") as any;
  assert.equal(write.narration, write.text, "fallback narration defaults to the line's own text — the only reasonable default with no richer prose available");
});

test("toNarratedSegments groups a write command with its trailing emphasis commands, up to the next write", () => {
  const plan = normalizeWhiteboardPlan({
    version: 1, autoplay: true,
    commands: [
      { id: "eq1", action: "write", text: "2x + 3y = 110", narration: "First equation.", durationMs: 1800 },
      { id: "p1", action: "pause", durationMs: 500 },
      { id: "u1", action: "underline", target: "eq1", durationMs: 700 },
      { id: "eq2", action: "write", text: "2x + 5y = 170", narration: "Second equation.", durationMs: 1800 },
      { id: "c1", action: "circle", target: "eq2", durationMs: 700 },
    ],
  }, ["fallback"]);
  const segments = toNarratedSegments(plan);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].narration, "First equation.");
  assert.equal(segments[0].commands.length, 3, "write + pause + underline");
  assert.equal(segments[0].visualDurationMs, 1800 + 500 + 700);
  assert.equal(segments[1].narration, "Second equation.");
  assert.equal(segments[1].commands.length, 2, "write + circle");
});

test("toNarratedSegments handles a null narration segment (legacy material) without throwing", () => {
  const plan = normalizeWhiteboardPlan({
    version: 1, autoplay: true,
    commands: [{ id: "l1", action: "write", text: "No narration here", durationMs: 1000 }],
  }, ["fallback"]);
  const segments = toNarratedSegments(plan);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].narration, null);
});

test("toNarratedSegments puts leading non-write commands (e.g. an opening clear) in their own narration-less segment, never dropped", () => {
  const plan: any = { version: 1, autoplay: true, commands: [
    { id: "clear1", action: "clear", durationMs: 200 },
    { id: "l1", action: "write", text: "Start here", narration: "Let's begin.", durationMs: 1000 },
  ]};
  const segments = toNarratedSegments(plan);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].narration, null);
  assert.equal(segments[0].commands[0].action, "clear");
  assert.equal(segments[1].narration, "Let's begin.");
});

test("the shared prompt instruction requires narration and explains it must not be a flat symbol readout", () => {
  assert.ok(WHITEBOARD_COMMAND_JSON_INSTRUCTION.includes('"narration"'));
  assert.ok(/required, not optional/i.test(WHITEBOARD_COMMAND_JSON_INSTRUCTION));
  assert.ok(/complete, natural spoken sentence/i.test(WHITEBOARD_COMMAND_JSON_INSTRUCTION));
});
