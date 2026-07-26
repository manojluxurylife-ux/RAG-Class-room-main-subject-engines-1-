# Free Drag-and-Drop Panel Repositioning (2026-07-21)

Full pick-up-and-move-anywhere repositioning for RAG Classroom's three
main panels (Textbook+thumbnails, AI Notes, Whiteboard), plus resizing
from the corner — the option chosen over resize-only.

## Checked before building

Confirmed no existing drag/resize infrastructure to reuse anywhere in
the app — searched thoroughly rather than trust an earlier assumption
(a different session's memory suggested a floating dock elsewhere had
draggable, persisted positioning; checked that component directly and
found no such logic in this codebase). This is a genuine ground-up
build, not a wiring job.

## The design decision worth knowing about

Free-floating drag-and-drop only activates at **1024px viewport width
and wider**. Below that, the exact original static grid layout renders
unchanged — same markup, same classes, same behavior as before this
feature existed. This wasn't a shortcut; it's deliberate: a
free-floating window system is a genuinely poor fit for a small
touchscreen (imprecise dragging, panels easily lost off-screen, no room
to usefully rearrange three panels on a phone-sized display), and this
app is explicitly built for budget Android phones. Forcing the new
layout everywhere regardless of screen size would have made things
worse for the primary audience to deliver a feature that's genuinely
most useful on a tablet or laptop anyway.

## What was built

**`lib/client/panel-layout.ts`** — pure, dependency-free layout math:
- `defaultPanelLayout()` — a sensible starting three-across arrangement.
- `clampRectToCanvas()` — the safety net: a panel can be dragged mostly
  off an edge to tuck it out of the way, but never so far it becomes
  unreachable; resizing is bounded to a sensible minimum and to the
  canvas's own size, so a panel can never become too small to use its
  own controls, or larger than the screen has room for.
- `bringToFront()` — the panel just touched always rises above the
  others, matching how any real window manager behaves.
- `loadPanelLayout()` / `savePanelLayout()` / `resetPanelLayout()` —
  localStorage persistence, with corrupted/foreign data treated as "no
  saved layout" rather than crashing the page.

**`components/FloatingPanel.tsx`** — the reusable panel wrapper:
- Real pointer-event dragging (`onPointerDown`/`Move`/`Up` with pointer
  capture) — one implementation that correctly handles mouse, touch,
  and pen input, rather than separate handlers for each.
- Dragging is restricted to the title bar specifically, and resizing to
  a dedicated corner handle — never the whole panel body — so nothing
  inside (buttons, the PDF thumbnails, the whiteboard's own canvas)
  loses its normal click/tap behavior to an accidental drag start.
- `touch-none` applied to both the drag handle and resize handle, so
  touch dragging doesn't fight with the browser's native scroll gesture.
- When not in floating mode, renders as a plain, ordinary in-flow
  element using the exact original CSS classes passed in — genuinely
  the same markup as before, not a disabled/degraded version of the
  new component.

**Wired into `app/(student)/rag-classroom/page.tsx`** — each of the
three panels' outer wrapper `<div>` replaced with `<FloatingPanel>`,
with everything inside completely untouched. A real layout bug was
caught and fixed while doing this: the AI Notes panel's tabs and
scrolling content depend on their immediate parent being a flex column
to size correctly — the floating-mode content wrapper didn't originally
preserve that, which would have silently broken the Notes panel's
internal layout the moment it was dragged into floating mode. Fixed in
`FloatingPanel` itself before it ever shipped, not discovered later.

Persistence is debounced (400ms after the last change) rather than
saved on every pointer-move during a drag — a single drag can fire
dozens of position updates a second, and only the final position
actually matters.

A "Reset layout" button and a one-line usage hint appear only when
floating mode is active, so a student who tangles the panels together
always has a clear way back to the default arrangement.

## Verification

- `tsc --noEmit`: clean, zero output.
- New `tests/panel-layout.test.ts` (10/10): correct default layout
  generation (including on a tiny canvas, still respecting minimum
  sizes), a normally-placed panel left unchanged by clamping, a panel
  dragged far off either edge still landing somewhere reachable, a
  resize attempt below the minimum correctly floored, a resize attempt
  above the canvas size correctly capped, `bringToFront` correctly
  raising a panel above all others, correctly returning the exact same
  object reference when nothing needs to change (avoiding a wasted
  re-render), and a safe no-op on an unknown panel id.
- All 18 other existing test suites still pass (119/119) — 129 tests
  total in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle: confirmed the new
  "Reset layout" text is genuinely present in what ships.

## Honest scope note

This covers RAG Classroom's three main panels specifically, since
that's what was asked about. The same `FloatingPanel` component is
general enough to reuse elsewhere in the app if other pages would
benefit from the same treatment later.
