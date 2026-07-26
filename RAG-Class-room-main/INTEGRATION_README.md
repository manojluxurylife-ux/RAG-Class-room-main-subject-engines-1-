# AI Guru Brain2 — RAG Classroom Edition

This package keeps the original Brain2 app and adds `/rag-classroom`:

- DeepTutor-inspired textbook ingestion, chunking, retrieval and page citations.
- OpenMAIC-inspired scene player with teacher narration, blackboard, questions and browser TTS.
- Gemini-grounded generation with deterministic fallback when no API key is available.
- JSON file persistence in `RAG_DATA_DIR`; Docker Compose mounts a persistent volume.

## Run locally
1. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000/rag-classroom`.

## Docker
`docker compose up --build -d`

## Production notes
- Text-layer PDFs work directly. Scanned PDFs require OCR before indexing.
- The included retrieval is lightweight lexical retrieval to keep deployment simple. Replace `lib/rag/store.ts` with PostgreSQL/pgvector or Qdrant for multi-user scale.
- Add authentication and per-user document isolation before public SaaS deployment.
