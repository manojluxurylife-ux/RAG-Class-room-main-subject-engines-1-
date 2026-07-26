# Offline generated materials

## Behaviour

After Gemini BYOK, server Gemini, or Qwen finishes a Material Studio job, the complete structured result is automatically stored in IndexedDB on that device. The saved record includes text, sections, quiz answers, source references, visual JSON, QA metadata, and agent-run metadata.

Prepared guided study courses are cached automatically when the student opens them online. If the API or internet later becomes unavailable, the player loads the IndexedDB copy and keeps segment navigation, quizzes, diagrams, and local progress working.

## Offline Library

Open `/offline-library`. This page never calls Gemini, Firestore, Cloud Storage, or RAG APIs to read a saved item. Materials can also be exported as JSON.

## Visuals

Bundled renderers (graphs, charts, Mermaid, molecules, circuits, biology, fractions, number lines, Three.js solids) work from saved JSON. GeoGebra normally loads its web applet; when completely offline before the applet has ever been cached, the app shows the saved construction commands and caption rather than a blank visual.

## Device scope

IndexedDB storage is browser/device specific. Clearing site data, uninstalling the PWA without preserving data, private-browsing cleanup, or browser storage eviction can remove it. Export important materials as JSON for backup.

## Service worker

The service worker caches the PWA shell and already-used Next.js chunks/assets. Material content is intentionally kept in IndexedDB rather than the HTTP cache so it can be indexed, updated, deleted, and isolated from API response caching.
