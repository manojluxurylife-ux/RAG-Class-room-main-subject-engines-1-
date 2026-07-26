# Live Spotlight on the Textbook Page (2026-07-21)

## Correction from last message

I initially assessed this as needing a large rebuild (the main PDF view
is an iframe, opaque to any overlay). That assessment was based on
incomplete investigation — a fuller read of the code found
`TextbookPageView`, a component already used whenever the raw PDF file
is available (the common case; the iframe is only a fallback for when
it isn't). It already does everything the "big rebuild" would have
built: renders the page onto a canvas, pulls real text positions
straight from the PDF via `getTextContent()`, fuzzy-matches a phrase
against them, and draws a "torch beam" — dimming the rest of the page
so the matched paragraph stands out, exactly like a teacher shining a
light on one part of an open book. The actual gap was much smaller: the
spotlight phrase was static, computed once when a scene starts, never
updating as teaching progressed through the page.

## The fix

**`app/(student)/rag-classroom/page.tsx`** — the spotlight phrase now
tracks `activeUnitIndex`, the same state introduced last session that
already drives the split-view text panel and the paragraph-by-paragraph
audio. As teaching moves from one paragraph to the next, the spotlight
phrase updates to that paragraph's own extracted text, and the existing
`transition-all duration-700 ease-out` on the beam makes it glide
smoothly to the new location rather than jumping — which is what
actually produces the "live teaching" feeling. Falls back to the
original whole-scene phrase for scenes without paragraph units (legacy
materials), unchanged.

## Two real, pre-existing precision issues found while testing

Extracted the matching logic into `lib/client/text-spotlight.ts` so it
has real test coverage — worth doing now that it runs once per
paragraph instead of once per scene. Writing those tests surfaced two
genuine bugs in the *original* algorithm (present before this session,
not introduced by it):

1. **A phrase found partway through an accumulated window returned
   extra, irrelevant items from before the match actually started** —
   e.g. matching "Pairs of Equations" inside "Chapter 7: Pairs of
   Equations" returned all five items, including "Chapter" and "7:",
   not just the three that make up the phrase. The spotlight box would
   have been visibly larger and less precise than the actual paragraph.
   **Fixed**: rewritten to build one combined, offset-mapped string for
   the whole page and search it once, returning only the items whose
   character ranges genuinely overlap the match — precise by
   construction, and simpler than the old nested sliding window.
2. **`normalize()`'s letter-only regex strips Malayalam's combining
   vowel signs** (a Unicode "Mark," not a "Letter"). Confirmed this
   doesn't break matching in practice — both the page text and the
   search phrase go through the same function, so the "mangling" is
   consistent on both sides — but it's a real, honest characteristic
   worth knowing about if this function is ever reused somewhere that
   displays the normalized text directly rather than just matching
   with it. Not changed here; flagging it plainly rather than silently
   leaving it undocumented.

## Verification

- `tsc --noEmit`: clean, zero output.
- New `tests/text-spotlight.test.ts` (11/11): correct multi-item phrase
  matching, matching starting partway through a page (the exact case
  that caught the precision bug above), a genuine non-match returning
  null rather than a false positive, an empty page (scanned PDF)
  returning null, a too-short phrase rejected, punctuation/case
  tolerance, correct percentage-bounds math including edge cases (near
  page edges, a match spanning the whole page).
- All 16 other existing test suites still pass (108/108) — 119 tests
  total in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages — itself
  strong confirmation the new module's imports resolve correctly,
  since a broken import would have failed the build outright.

## Honest note on scope

This makes the *existing* spotlight mechanism track the current
paragraph — it doesn't change how phrases are matched beyond the
precision fix above. On a scanned PDF with no real text layer, the
spotlight still won't appear (by original, deliberate design — "a
missing spotlight is a shrug; a wrong spotlight would be a lie"), same
as before this change.
