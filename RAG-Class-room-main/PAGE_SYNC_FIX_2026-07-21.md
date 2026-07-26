# PDF, AI Notes, and Whiteboard Page Sync (2026-07-21)

## What was checked, and confirmed broken

Traced exactly what happens when a student clicks a page thumbnail, or
the PDF viewer's own prev/next buttons. Found the PDF pane and the
lesson (AI notes + whiteboard) were running on **two completely
disconnected navigation systems**:

- Thumbnail clicks and the PDF viewer's prev/next buttons called
  `setPageNum(p)` directly — moving only the visible PDF page.
- A *separate* "next/previous topic" control elsewhere on the page
  already called `goScene()`, which correctly moves the scene, the
  notes, the whiteboard, **and** the page number together, stopping any
  stale narration first.

The only link between "which page is showing" and "which scene is
active" was one-directional: advancing the *scene* correctly moved the
PDF page to match. Nothing made the reverse true. So clicking a
thumbnail changed the PDF page while the AI notes and whiteboard stayed
frozen on whatever scene was last playing — exactly the desync
reported. Confirmed by reading the actual click handlers and the
component's effect dependencies, not inferred from behavior alone.

## The fix

New `lib/scene-page-sync.ts` — a small, pure, independently-tested
function, `findSceneIndexForPage(scenes, page)`, that finds which
lesson scene a given PDF page belongs to: an exact match when one
exists, or the closest **preceding** scene when a page has no teaching
content of its own (a title or reference page the lesson skipped) —
rather than landing on nothing.

New `goToPage(page)` in the classroom page is now the single entry
point for all three PDF-navigation controls (both thumbnail rows and
the prev/next chevrons). It finds the matching scene and routes through
`goScene()` — the exact same correct mechanism the separate topic
navigation already used — so a thumbnail click now stops stale
narration, and moves the scene, the notes, the whiteboard, and the page
number together, instead of moving the page number alone.

**Honest tradeoff, not hidden:** if the clicked page has no scene of
its own, the PDF pane "snaps" to whichever page the matched scene
actually represents, rather than staying on the literally-clicked page
while notes/whiteboard show something else. This keeps the invariant
you asked for — PDF, notes, and whiteboard always showing the *same*
page number — as the higher priority. For the common case (a scene
generated per page), this snapping never triggers and the numbers just
naturally match everywhere, all the time.

**Scene advancement itself was already correct** and needed no change
— confirmed by reading it, not just assuming: `syncScene()` already
updates the page number and persists progress every time a scene
change happens during normal class playback.

## Verification

- `tsc --noEmit`: **clean, zero output** — still holds after this
  change, on top of last session's fix.
- New `tests/scene-page-sync.test.ts` (8/8): exact-page matching,
  correct handling of two scenes sharing one page (returns the first,
  consistently, not arbitrarily), fallback to the closest preceding
  scene for a page with no dedicated content, `-1` for a page before
  any scene exists, correct behavior past the last scene's page,
  graceful handling of no lesson loaded at all, scenes with a missing
  or invalid page number safely ignored rather than wrongly matched,
  and correct matching even when scenes aren't in page order.
- All 13 other existing test suites still pass (89/89) — 97 tests total
  in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages.
