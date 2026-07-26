/**
 * Tests for lib/client/verify-session.ts's isSessionExpiredResponse() —
 * the fix that gives an honest, specific message when a chapter exam
 * result fails to save because the student's login expired, instead of
 * a vague "please retry" that doesn't explain the result never reached
 * the Parent Portal.
 *
 * Run with: npx tsx --test tests/verify-session.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSessionExpiredResponse } from "../lib/client/verify-session";

test("matches 401 Unauthorized", () => {
  assert.equal(isSessionExpiredResponse(401), true);
});

test("matches 403 Forbidden — requireStudentMatching returns this for a mismatched studentId, not just a missing session", () => {
  assert.equal(isSessionExpiredResponse(403), true);
});

test("does not match a genuine server or client error unrelated to auth", () => {
  assert.equal(isSessionExpiredResponse(500, "Database connection failed"), false);
  assert.equal(isSessionExpiredResponse(400, "Answer every question"), false);
});

test("also matches on the exact server error text as a fallback, even with an unexpected status", () => {
  assert.equal(isSessionExpiredResponse(0, "Please log in to use this feature."), true);
  assert.equal(isSessionExpiredResponse(200, "Could not save test result"), false);
});
