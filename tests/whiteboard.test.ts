import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWhiteboardPlan, validateWhiteboardPlan } from "../lib/whiteboard-commands";
import { layoutWhiteboardText } from "../lib/whiteboard-layout";

const metrics = { measure: (text: string, fontSize: number) => Array.from(text).length * fontSize * 0.55 };

test("strict validator rejects duplicate IDs and forward/missing targets", () => {
  const issues = validateWhiteboardPlan({ version: 1, commands: [
    { id: "x", action: "underline", target: "later" },
    { id: "later", action: "write", text: "A" },
    { id: "later", action: "write", text: "B" },
    { id: "arrow", action: "arrow", from: "later", to: "missing" },
  ]});
  assert.ok(issues.some(x => x.code === "unknown-target"));
  assert.ok(issues.some(x => x.code === "duplicate-id"));
});

test("normalizer repairs duplicate IDs and removes dangling commands", () => {
  const plan = normalizeWhiteboardPlan({ version: 1, commands: [
    { id: "x", action: "underline", target: "missing" },
    { id: "same", action: "write", text: "First" },
    { id: "same", action: "write", text: "Second" },
    { id: "ok", action: "underline", target: "same" },
    { id: "bad", action: "arrow", from: "same", to: "missing" },
  ]});
  assert.deepEqual(plan.commands.map(c => c.id), ["same", "same-2", "ok"]);
  assert.equal((plan.commands[2] as any).target, "same");
});

test("layout wraps long English and Malayalam content within width", () => {
  const layout = layoutWhiteboardText("മലയാളം എഴുത്ത് പരിശോധന long English sentence wraps", 140, 24, metrics);
  assert.ok(layout.lines.length > 1);
  assert.ok(layout.lines.every(line => metrics.measure(line, layout.fontSize) <= 140.001));
  assert.ok(layout.height > layout.lineHeight);
});

test("layout shrinks font to satisfy constrained height", () => {
  const layout = layoutWhiteboardText("one two three four five six seven eight nine ten", 120, 30, metrics, 80);
  assert.ok(layout.fontSize < 30);
  assert.ok(layout.height <= 80 || layout.fontSize === 12);
});
