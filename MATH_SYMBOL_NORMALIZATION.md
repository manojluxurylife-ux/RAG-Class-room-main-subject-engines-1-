# Mathematical-symbol normalization

The RAG ingestion path now applies Unicode NFKC cleanup, maps known SCERT/legacy embedded-font glyphs, removes unsafe controls, preserves unknown glyphs as `⟦GLYPH?⟧`, extracts equation-like lines, stores LaTeX and Math.js parse results, and reports suspicious pages.

Optional equation OCR uses `/api/math-ocr` and a private Pix2Text worker.

```env
MATH_OCR_WORKER_URL=https://YOUR-WORKER.run.app
MATH_OCR_SHARED_SECRET=long-random-secret
```

Normal searchable pages stay on the fast PDF.js route; only suspicious equation crops should be sent to OCR.
