# OpenMAIC-style Textbook Pointing Integration

## Added behaviour

During a prepared study-material class, AI Guru now coordinates:

1. The original textbook page.
2. A flashlight/spotlight around the passage or diagram being discussed.
3. A red laser pointer inside the focused area.
4. The pre-generated whiteboard explanation, examples, and staged visual plan.

## Generation contract

Every generated segment can include `textbookCues`. The cues follow the exact teaching order: points, example problem, example steps, and example answer.

Each cue contains:

- `quote`: a verbatim phrase for accurate PDF text-layer matching.
- `page`: the 1-based PDF page number.
- `region`: percentage coordinates used as a fallback for scans and photos.

## Rendering

- Searchable PDF: PDF.js locates the verbatim phrase and focuses it.
- Scanned PDF/photo: the stored percentage region is used.
- The active cue changes as the typewriter advances to the next teaching line.
- The whiteboard's `visualizationPlan` continues to reveal phases according to completed teaching lines.

## Validation

`npx tsc --noEmit` passed.

## Accuracy note

For scanned pages, Gemini estimates the focus rectangle. It should be evaluated with representative textbooks because image layout and OCR quality can affect pointing accuracy.
