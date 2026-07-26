/**
 * A real secret-key requirement layered on top of DEV_BYPASS_LOGIN —
 * requested explicitly: the existing bypass (lib/dev-mode.ts) is fully
 * open to anyone who visits the login page while the flag is on, with
 * no credential at all. This adds an actual secret the admin sets
 * themselves, so even if DEV_BYPASS_LOGIN is accidentally left on, a
 * random visitor still can't get in without knowing it. Real defense
 * in depth, not just a second copy of the same weak check.
 *
 * ADMIN_ENTRY_KEY is a real environment variable the admin sets in
 * their hosting provider (same pattern as ADMIN_EMAIL/ADMIN_PASSWORD
 * for the normal admin login) — never hardcoded in source. If it isn't
 * set at all, this fails CLOSED (bypass refuses to run), not open —
 * "forgot to configure a key" should never silently mean "no key
 * needed."
 *
 * "Remembering" the key across portal switches (so the admin doesn't
 * retype it every time they jump between portals from the persistent
 * switcher) is NOT done with a plain cookie holding "verified: true" —
 * that could be forged by anyone setting the same cookie value in
 * devtools, with zero knowledge of the actual key. Instead, the
 * verification cookie's value is a SHA-256 hash of the real key,
 * computed server-side. Forging the correct hash without knowing the
 * actual key would require breaking SHA-256 pre-image resistance —
 * infeasible — while a genuine holder of the key gets a working,
 * reusable proof of having entered it once.
 */
import { createHash } from "crypto";

export const ADMIN_ENTRY_COOKIE = "gg_admin_entry_verified";

function expectedProof(): string | null {
  const key = process.env.ADMIN_ENTRY_KEY;
  if (!key) return null; // not configured — fail closed, never fall back to "no key needed"
  return createHash("sha256").update(key).digest("hex");
}

/** True if the raw key typed by the admin matches the configured secret. */
export function isValidAdminEntryKey(providedKey: string | undefined | null): boolean {
  const expected = process.env.ADMIN_ENTRY_KEY;
  if (!expected || !providedKey) return false;
  return providedKey === expected;
}

/** True if a previously-issued proof cookie still matches the current
 *  secret — lets the persistent portal switcher re-use one earlier
 *  successful key entry, without ever storing the actual key itself. */
export function isValidAdminEntryProof(proofCookieValue: string | undefined | null): boolean {
  const expected = expectedProof();
  if (!expected || !proofCookieValue) return false;
  return proofCookieValue === expected;
}

/** The value to store in the proof cookie right after a correct key was entered. */
export function computeAdminEntryProof(): string | null {
  return expectedProof();
}
