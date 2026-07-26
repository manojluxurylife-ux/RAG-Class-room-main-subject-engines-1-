/**
 * Security-hardening tests — session signing, rate limiting, and the
 * VPS path-traversal guard. Run with:  npx tsx --test tests/security.test.ts
 * (No Firestore/network needed — everything here is pure logic.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-for-unit-tests";

test("signSession → verifySession round-trips", async () => {
  const { signSession, verifySession } = await import("../lib/session-sign");
  const cookie = await signSession({ userId: "s1", role: "student", name: "A", email: "a@b.c" });
  const parsed = await verifySession<{ userId: string; role: string; email: string }>(cookie);
  assert.equal(parsed?.userId, "s1");
  assert.equal(parsed?.role, "student");
  assert.equal(parsed?.email, "a@b.c");
});

test("tampered payload and tampered signature both verify to null", async () => {
  const { signSession, verifySession } = await import("../lib/session-sign");
  const cookie = await signSession({ userId: "s1", role: "student", name: "A" });
  const [payload, sig] = [cookie.slice(0, cookie.lastIndexOf(".")), cookie.slice(cookie.lastIndexOf(".") + 1)];

  // Forge the payload (role escalation attempt), keep the old signature.
  const forgedPayload = Buffer.from(JSON.stringify({ userId: "s1", role: "admin", name: "A" }))
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.equal(await verifySession(`${forgedPayload}.${sig}`), null);

  // Flip one char of the signature.
  const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
  assert.equal(await verifySession(`${payload}.${flipped}`), null);

  // Legacy unsigned JSON cookie.
  assert.equal(await verifySession(JSON.stringify({ role: "admin" })), null);
});

test("rate limiter blocks after the limit and clears on success", async () => {
  const { rateLimit, rateLimitClear } = await import("../lib/rate-limit");
  const key = "test:acct";
  for (let i = 0; i < 5; i++) {
    assert.equal(rateLimit(key, 5, 60_000).limited, false, `attempt ${i + 1} should pass`);
  }
  const sixth = rateLimit(key, 5, 60_000);
  assert.equal(sixth.limited, true);
  assert.ok(sixth.retryAfterSec >= 1);

  rateLimitClear(key);
  assert.equal(rateLimit(key, 5, 60_000).limited, false, "cleared key should pass again");
});

test("VPS listing rejects traversal and absolute paths", async () => {
  const { listVPSFiles } = await import("../lib/storage/vps");
  // These must all come back empty (rejected), never throw or escape.
  assert.deepEqual(listVPSFiles("../../../../etc"), []);
  assert.deepEqual(listVPSFiles(".."), []);
  assert.deepEqual(listVPSFiles("/etc"), []);
  assert.deepEqual(listVPSFiles("maths/../../.."), []);
});

test("vpsPublicUrl throws on traversal refs", async () => {
  const { vpsPublicUrl } = await import("../lib/storage/vps");
  assert.throws(() => vpsPublicUrl("../secret.pdf"));
  assert.equal(typeof vpsPublicUrl("maths/class8/algebra.pdf"), "string");
});

test("sessionOwns matches id or email, admin always passes", async () => {
  const { sessionOwns } = await import("../lib/auth");
  const student = { userId: "stu_1", role: "student" as const, name: "A", email: "kid@example.com" };
  assert.equal(sessionOwns(student, "stu_1"), true);
  assert.equal(sessionOwns(student, "KID@example.com"), true);
  assert.equal(sessionOwns(student, "stu_2"), false);
  assert.equal(sessionOwns(student, ""), false);
  const admin = { userId: "admin", role: "admin" as const, name: "Admin" };
  assert.equal(sessionOwns(admin, "anything"), true);
});
