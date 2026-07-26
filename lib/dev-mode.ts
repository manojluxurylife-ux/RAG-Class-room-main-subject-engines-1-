/**
 * Single switch to disable OTP/email verification while building.
 *
 * Dev stage (current default): signup goes straight through — no OTP,
 * no email confirmation, free entry — so you can test flows quickly.
 *
 * Going to market: flip this to false (or better, delete this file and
 * the `if (SKIP_VERIFICATION)` branches that reference it) so every new
 * account actually passes phone/email verification before getting in.
 *
 * Search the codebase for `SKIP_VERIFICATION` to find every place this
 * affects: currently app/(auth)/signup/student/page.tsx.
 */
export const SKIP_VERIFICATION = true;

/**
 * Second switch, same spirit as SKIP_VERIFICATION above — lets you enter
 * ANY portal (student, parent, admin, school) with one click, no login
 * form, no real credentials. Requested explicitly for pre-marketing
 * testing: "for the time being... we will make it active when we enter
 * marketing."
 *
 * This is real access, not a fake preview — the login page's bypass
 * buttons create/reuse genuine test accounts (fixed emails like
 * test-student@nexusaiguru.test) and set the same session cookie a real
 * login would, so every feature works against real data exactly as it
 * would for an actual user.
 *
 * SAFETY — this is the one flag in this file that's genuinely dangerous
 * to forget: it means literally anyone visiting the live site can enter
 * every portal, including admin, with zero credentials. Three layers on
 * purpose, not just this comment:
 *   1. A bright, impossible-to-miss banner renders on every portal
 *      whenever this is true (components/DevBypassBanner.tsx) — visible
 *      on the live site itself, not just in source code.
 *   2. The bypass buttons only appear on the login page when this flag
 *      is true — flip it to false and they simply don't render, no
 *      further cleanup needed there.
 *   3. Before marketing: flip this to `false`. Search the codebase for
 *      `DEV_BYPASS_LOGIN` to see every place it's checked.
 */
export const DEV_BYPASS_LOGIN = true;

/**
 * Subscription enforcement — the launch switch for the dunning flow
 * (lib/subscription-policy.ts). While false (development stage), every
 * student gets FULL access regardless of subscription state; the lazy
 * reconciler and admin statuses still run truthfully underneath, so you
 * can watch the machinery work before it has teeth. Flip to true at
 * launch to activate grace → degrade gating on premium pages.
 */
export const ENFORCE_SUBSCRIPTIONS = false;
