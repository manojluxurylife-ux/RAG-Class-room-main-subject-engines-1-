/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Used to slow password brute-forcing on /api/auth/login — scrypt makes
 * each guess expensive, but nothing previously capped how many guesses
 * an attacker could make.
 *
 * HONEST LIMITATION: state lives in this server process's memory. On a
 * single VPS (PM2/Nginx) that's exactly right; on serverless (Netlify
 * functions) each warm instance counts separately, so this is a speed
 * bump rather than a hard wall there. Swapping the Map for Upstash/Redis
 * (db-upstash.ts already exists in this repo) upgrades it without
 * changing any caller — the interface is one function.
 */

interface Window { hits: number[]; }

const buckets = new Map<string, Window>();

// Opportunistic cleanup so long-running processes don't grow unbounded.
let lastSweep = 0;
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of buckets) {
    w.hits = w.hits.filter(t => now - t < windowMs);
    if (w.hits.length === 0) buckets.delete(key);
  }
}

/**
 * Record one attempt for `key` and report whether it exceeded the limit.
 * Returns { limited, retryAfterSec }.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now, windowMs);
  const w = buckets.get(key) || { hits: [] };
  w.hits = w.hits.filter(t => now - t < windowMs);
  if (w.hits.length >= limit) {
    buckets.set(key, w);
    const oldest = w.hits[0];
    return { limited: true, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  w.hits.push(now);
  buckets.set(key, w);
  return { limited: false, retryAfterSec: 0 };
}

/** On success (correct password), clear the caller's counter so a
 *  legitimate user who fumbled a few times isn't still throttled. */
export function rateLimitClear(key: string) {
  buckets.delete(key);
}

/** Best-effort client IP for keying — proxies set x-forwarded-for. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || req.headers.get("x-real-ip") || "unknown";
}
