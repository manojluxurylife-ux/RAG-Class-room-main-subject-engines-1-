# AI Guru Brain2 — Seven-Defect Repair

## Implemented

1. **Scanned-PDF OCR fallback** — RAG Classroom first tries PDF.js text extraction and automatically sends image-only PDFs to the authenticated Gemini document-OCR route.
2. **Raw PDF progressive continuation** — Study Materials now stores PDF originals as PDFs, preserves MIME type, and sends the same PDF back to Gemini for remaining segments.
3. **Textbook grounding QA** — first-stage generation stores a source transcript and source-topic list; QA blocks auto-publication when source alignment is weak or unavailable.
4. **Formula consistency QA** — formula-heavy subjects receive bracket/delimiter and invalid-result checks. This is a safety screen, not a formal proof engine.
5. **Topic coverage report** — QA reports how many source topics appear in generated teaching content and flags partial coverage.
6. **Deployment diagnostics** — configuration checklist and reproducible validation commands are included below.
7. **Student data isolation** — Study Material list, upload and continuation now derive ownership from the signed HttpOnly session cookie instead of trusting a browser-supplied student ID.

## Required production configuration

- `SESSION_SECRET`
- Gemini API configuration used by `callGeminiWithImage`
- Firestore credentials
- `GCS_KEY_JSON` and `GCS_BUCKET` for PDFs larger than testing-mode storage limits
- Admin credentials

## Validation commands

```bash
npm ci
npx tsc --noEmit
npm run build
```

Use two separate student accounts to verify that a material ID belonging to Student A returns 404 when requested by Student B. Test a searchable PDF, scanned PDF, Malayalam PDF, mathematics page, and an 8 MB boundary file.

## Honest limits

OCR and semantic QA depend on Gemini and therefore require real API integration tests after deployment. Formula checks catch malformed output but do not mathematically prove every derivation. Full-book chapter completeness is measurable only when the complete book is uploaded through RAG Classroom; single-page Study Materials checks coverage of that uploaded page.
