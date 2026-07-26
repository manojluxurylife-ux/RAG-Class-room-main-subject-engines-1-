# Save to Device First, Fall Back to Student's Drive When Full (2026-07-21)

## What already existed, found before building anything

Same pattern as the last several sessions in this codebase: the
foundation for this feature was already fully built, just never
connected to the actual material-saving flow.

- `lib/storage-check.ts` — `checkDeviceStorage()`, a real
  `navigator.storage.estimate()`-based check with a sensible "running
  low" threshold. Already used in exactly one place
  (`app/(student)/materials/page.tsx`'s download flow) to decide
  whether to offer Drive instead of downloading straight to a full
  device.
- `lib/student-drive.ts` — a complete, working Google Drive pipeline:
  `requestStudentDriveAccess()` (Google's own OAuth consent screen,
  narrow `drive.file` scope — only ever touches files this app itself
  created), `uploadOfflinePackageToDrive()`, `listOfflinePackagesFromDrive()`,
  `downloadOfflinePackageFromDrive()`.
- `lib/offline-materials.ts` — `createPortableOfflinePackage()` /
  `importPortableOfflinePackage()`, a ready-made, self-contained
  serialization format for exactly this purpose (already used by
  Offline Library's manual backup button).

None of this touched Material Studio's actual save path
(`saveStudioMaterial`, called every time a material finishes
generating). This delivery connects it.

## The fix

**`lib/offline-materials.ts`** — extracted `buildStudioMaterialRecord()`
as its own pure, exported function (previously inlined inside
`saveStudioMaterial`). Needed so a Drive fallback can build the exact
same record even when the local IndexedDB write itself is what's
failing.

**New `lib/client/save-with-drive-fallback.ts`** —
`saveStudioMaterialWithDriveFallback()`: tries the device first, always
— that's what makes offline classroom playback work, so this is zero
behavior change for the normal case where a phone has room. Only on an
actual local-save failure does it fall back to Drive:
- Builds the record, requests (or reuses a cached) Drive access token,
  packages it via the existing portable-package format, uploads it.
- **The access token is cached and reused for the whole batch** — a
  Material Studio run can save 50+ materials; re-triggering Google's
  consent popup separately for every single one would be unusable. One
  permission request per batch (tokens last ~1 hour, comfortably longer
  than any realistic run), not one per material.
- Every dependency (the local save, the Drive calls, the storage
  check) is injectable, defaulting to the real implementations — every
  actual call site in the app is unaffected; only tests override them,
  since IndexedDB and Google's OAuth popup both need a real browser and
  can't be exercised directly in this sandbox.
- Never throws — always resolves to `{savedTo: "device"|"drive"|"failed"}`,
  so a save failure for one material doesn't abort the rest of a batch.

**`app/(student)/material-studio/page.tsx`**:
- A one-time, proactive `checkDeviceStorage()` check runs before a
  batch starts (not per-material) — if the device looks low, shows a
  clear heads-up *before* Google's real sign-in popup ever appears,
  rather than a student discovering the switch mid-batch with no
  context.
- The actual per-material save call now routes through
  `saveStudioMaterialWithDriveFallback()`. Status messages are now
  honest about where each material actually landed ("Created · saved
  to Google Drive (device storage was full)" vs the normal "Created ·
  all 5 parts stored").
- The final batch summary explicitly calls out how many materials went
  to Drive instead of the device, and states the real consequence
  plainly: those specific materials need an internet connection to
  open later, unlike device-saved ones.
- **Real behavioral improvement, not just a fallback:** previously, a
  save failure for any reason would throw and abort the *entire*
  material group/part combination it was in. Since the new wrapper
  never throws, a save that can't be helped even by Drive (e.g. neither
  configured) now correctly fails just that one material and lets the
  rest of the batch continue — a strict improvement, found while making
  this change, not the original goal of it.
- `env.example`'s `NEXT_PUBLIC_GOOGLE_CLIENT_ID` comment updated to
  accurately describe every student-facing feature that shares it
  (Offline Library's manual backup, the Materials page's low-storage
  download fallback, and this new automatic Material Studio fallback),
  and to state plainly that without it, all three simply fail closed
  with a clear message rather than silently misbehaving.

## Honest limitation — stated in the code, and here

A material saved to Drive instead of the device is **not** available
for offline classroom teaching afterward — it needs a network
connection and the student's Drive sign-in to retrieve. This is a
last-resort safety net so material creation doesn't simply fail when a
device is genuinely full, not a replacement for local storage, which
this app's whole offline-first design is built around. The in-app
messaging says this explicitly, both in the per-material status and the
final batch summary — nothing about this is silent.

## Also true, not fixed here

`app/(student)/material-studio/page.tsx`'s `generate()` function has a
second, older `saveStudioMaterial()` call site — but `generate()` has
had no reachable caller since an earlier session removed its only
trigger button (dead manual single-material UI). Confirmed via search
before deciding not to touch it: genuinely unreachable code, left
as-is rather than edited for consistency's sake alone.

## Verification

- `tsc --noEmit`: clean, zero output — holds through this change too.
- New `tests/save-with-drive-fallback.test.ts` (7/7): device-save
  success never touches Drive at all; a local failure correctly falls
  back and reports `savedTo: "drive"`; the Drive permission prompt
  fires exactly once across many saves in the same batch, with every
  material still genuinely uploaded; the `onFallbackStarting` callback
  fires only when a fallback is actually needed, never on a successful
  device save; a clean `"failed"` result (not a thrown exception) when
  Drive isn't configured; a clean `"failed"` result when *both* the
  device and Drive genuinely fail; `resetDriveSession()` correctly
  forces a fresh permission request. One of these tests caught a real
  gap during writing: the fallback correctly refuses to attempt a
  Drive upload at all when Drive isn't configured, rather than trying
  and failing with a confusing error.
- All 14 other existing test suites still pass (97/97) — 104 tests
  total in the app now.
- Full `next build` via `npm run build`: clean, 74/74 pages.
- Checked the actual **compiled** client bundle for the Material
  Studio page: confirmed the new "Device storage is full" fallback
  status text is genuinely present in what ships.
