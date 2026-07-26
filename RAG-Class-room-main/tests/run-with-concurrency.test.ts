/**
 * Tests for lib/client/run-with-concurrency.ts — the utility behind
 * Material Studio's "create all materials at the same time" fix (see
 * app/(student)/material-studio/page.tsx's createAllStudyMaterials,
 * which used to run every (textbook-part × material-group) task fully
 * sequentially, labeled "part by part").
 *
 * Run with: npx tsx --test tests/run-with-concurrency.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConcurrency } from "../lib/client/run-with-concurrency";

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

test("runs all tasks and returns results in original index order regardless of finish order", async () => {
  const tasks = [
    () => delay(30).then(() => "slow"),
    () => delay(5).then(() => "fast"),
    () => delay(15).then(() => "medium"),
  ];
  const results = await runWithConcurrency({ tasks, concurrency: 3 });
  assert.deepEqual(results.map(r => (r.ok ? r.value : null)), ["slow", "fast", "medium"]);
});

test("never runs more than `concurrency` tasks at once", async () => {
  let active = 0, maxActive = 0;
  const tasks = Array.from({ length: 8 }, () => async () => {
    active++; maxActive = Math.max(maxActive, active);
    await delay(10);
    active--;
    return "done";
  });
  await runWithConcurrency({ tasks, concurrency: 3 });
  assert.ok(maxActive <= 3, `expected at most 3 concurrent, saw ${maxActive}`);
});

test("actually runs tasks in parallel, not sequentially — total time is much less than the sum of all durations", async () => {
  const tasks = Array.from({ length: 6 }, () => () => delay(20).then(() => "ok"));
  const start = Date.now();
  await runWithConcurrency({ tasks, concurrency: 3 });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 100, `expected well under sequential time (120ms), took ${elapsed}ms`);
});

test("a failing task does not stop the others, and its error is captured not thrown", async () => {
  const tasks = [
    () => delay(5).then(() => "ok-1"),
    () => Promise.reject(new Error("task 2 failed")),
    () => delay(5).then(() => "ok-3"),
  ];
  const results = await runWithConcurrency({ tasks, concurrency: 3 });
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal((results[1] as any).error.message, "task 2 failed");
  assert.equal(results[2].ok, true);
});

test("onSettled fires once per task, as each one finishes, for live progress updates", async () => {
  const seen: number[] = [];
  const tasks = [
    () => delay(20).then(() => "a"),
    () => delay(5).then(() => "b"),
    () => delay(10).then(() => "c"),
  ];
  await runWithConcurrency({ tasks, concurrency: 3, onSettled: (index) => seen.push(index) });
  assert.equal(seen.length, 3);
  assert.deepEqual(new Set(seen), new Set([0, 1, 2]));
  assert.ok(seen.indexOf(1) < seen.indexOf(0));
});

test("handles an empty task list without hanging", async () => {
  const results = await runWithConcurrency({ tasks: [], concurrency: 4 });
  assert.deepEqual(results, []);
});

test("concurrency higher than the task count does not break anything", async () => {
  const results = await runWithConcurrency({ tasks: [() => Promise.resolve(1), () => Promise.resolve(2)], concurrency: 10 });
  assert.deepEqual(results.map(r => (r.ok ? r.value : null)), [1, 2]);
});
