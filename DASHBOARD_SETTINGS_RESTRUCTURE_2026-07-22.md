# Dashboard/Settings Restructure + Nav Fix (2026-07-22)

## The real root cause, traced precisely

The screenshots showed "MiniCPM 3B" as the local model name, which
this project moved away from in an earlier session — so this exact
symptom couldn't be reproduced from this specific codebase's current
files. But investigating anyway surfaced a genuine, confirmed bug in
the shared navigation component that plausibly explains exactly what
was described.

**`components/StudentMainNav.tsx`'s "Settings" item was not a link —
it was a dropdown *toggle* with no destination of its own.** Every
other tab (Dashboard, Material Studio, RAG Classroom, etc.) is a plain
`<Link href="...">` that navigates immediately on click. "Settings"
was a `<button>` that only opened a small submenu of four quick-jump
anchors. Clicking it never navigated anywhere by itself — so whatever
page a student was already on (commonly Dashboard) stayed visible
underneath, which reads exactly like "Settings shows the same content
as Dashboard." This also directly explains the second complaint: reaching
Settings' real content took an extra step (open dropdown → click a
sub-item) that no other tab required, which is very plausibly what
felt like the menu "taking time to open."

## The fix

**`components/StudentMainNav.tsx`** — "Settings" is now a direct link
like every other tab, navigating to `/settings` on a single click. The
four quick-jump anchors weren't deleted — they're still available via a
small separate chevron button beside the label, for someone who already
knows they want a specific section. Confirmed the anchor IDs
(`#gemini-byok-keys`, `#local-model-download`, `#pdf-textbook-download`,
`#web-search-gemini`) still genuinely exist on the Settings page before
keeping them, rather than assuming.

**Dashboard's content moved to Settings, as asked** — welcome header,
lesson/streak stats, the "start today's lesson" shortcut, quick topic
shortcuts, recent lessons, and the study materials shortcut are now at
the top of `app/(student)/settings/page.tsx`, above its existing
content.

**One deliberate exception, and the reasoning for it:** the old
Dashboard's "Get set up" checklist (Gemini key + Local Brain download +
Download Syllabus, as three quick cards) was **not** brought along.
Reading Settings' existing content first showed it already has its own,
more thorough versions of the same two concerns — "Activate Brain1" (a
guided key-setup flow with voice narration and clipboard automation)
and "Download your textbook" (a real Gemini-search-grounded textbook
finder, richer than a plain link). Moving the checklist over as well
would have recreated the exact "two things that seem to duplicate each
other" confusion this whole change was meant to fix, just within one
page instead of across two. Flagging this plainly rather than silently
deciding it — it's a judgment call, and easy to reverse if the quick
checklist cards turn out to be wanted alongside the fuller flows.

**`app/(student)/dashboard/page.tsx`** — replaced with a genuine,
minimal placeholder (a header and one line pointing to Settings), not a
redirect — exactly as asked, ready to be filled in later.

## Worth knowing, not hidden

**Login and signup both redirect straight to `/dashboard`** as the
landing page after authentication — confirmed by checking the actual
auth routes, not assumed. That means every student, including a
brand-new signup, will land on this blank page first, then need to
click Settings (now a direct link) to see anything. The placeholder
page does say where to go next, but this is a real, visible
consequence of the request as given, not something quietly avoided —
worth deciding deliberately if the landing destination should change
later, rather than discovering it by surprise.

## Verification

- `tsc --noEmit`: clean, zero output.
- All 19 existing test suites still pass (129/129) — this change didn't
  touch any tested logic, only page content and one nav component.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** output: confirmed the moved welcome
  content is genuinely present in the Settings page bundle, the
  placeholder text is genuinely present in the Dashboard page bundle,
  and the new "Quick-jump to a settings section" chevron button is
  genuinely present in the shared layout bundle.
