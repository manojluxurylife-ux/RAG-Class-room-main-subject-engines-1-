/**
 * session-sign — HMAC-SHA256 signed session cookies.
 *
 * WHY: the gg_session cookie used to be plain JSON, and middleware.ts
 * trusted it as-is (its own TODO admitted this). That means role-based
 * access was decorative: anyone could open DevTools and set
 * gg_session={"role":"admin"} to walk into the admin portal. With the
 * admin portal now holding subscription/billing controls, that hole
 * has to close: every session cookie is now signed, and middleware +
 * getSession verify the signature before trusting the role.
 *
 * Built on Web Crypto (globalThis.crypto.subtle) — NOT node:crypto —
 * because middleware runs on the Edge runtime where node:crypto doesn't
 * exist. Web Crypto works in both places, so this is one implementation
 * for both verification points.
 *
 * Secret: SESSION_SECRET env var. Falls back to being derived from
 * ADMIN_PASSWORD (already required for admin login to work at all) so
 * existing deployments gain signing without a new mandatory env var.
 * The dev fallback keeps `npm run dev` working with zero setup — it's
 * fine for localhost, and real deployments always have ADMIN_PASSWORD.
 *
 * Cookie format: base64url(payloadJson) + "." + base64url(hmac)
 */

function getSecret(): string {
  const configured = process.env.SESSION_SECRET
    || (process.env.ADMIN_PASSWORD ? `gg-derived:${process.env.ADMIN_PASSWORD}` : "");
  if (configured) return configured;
  // FAIL CLOSED in production: signing with a publicly known constant
  // would let anyone forge an admin cookie. Localhost dev keeps working
  // with zero setup; a real deployment must set SESSION_SECRET (or
  // ADMIN_PASSWORD, from which one is derived).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET (or ADMIN_PASSWORD) must be set in production — " +
      "refusing to sign sessions with the built-in dev secret.",
    );
  }
  return "gg-dev-only-secret";
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const base = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return base.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const base = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob !== "undefined") return atob(base);
  return Buffer.from(base, "base64").toString("binary");
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(new Uint8Array(sig));
}

/** Object → signed cookie value. */
export async function signSession(session: object): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${await hmac(payload)}`;
}

/**
 * Signed cookie value → object, or null if missing/tampered/legacy.
 * A legacy unsigned-JSON cookie also returns null — the user simply
 * logs in again once and receives a signed cookie; silently accepting
 * unsigned cookies "for compatibility" would keep the forgery hole open.
 */
export async function verifySession<T = any>(raw: string | undefined | null): Promise<T | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig     = raw.slice(dot + 1);
  try {
    const expected = await hmac(payload);
    // Constant-time-ish comparison; lengths are fixed for HMAC-SHA256.
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    return JSON.parse(b64urlDecode(payload)) as T;
  } catch {
    return null;
  }
}
