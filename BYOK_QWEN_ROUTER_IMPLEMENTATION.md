# Gemini BYOK + Local Qwen Integration

## Implemented recommendations

1. **BYOK in RAG Classroom** — the browser retrieves source extracts from `/api/rag/context`, then calls Gemini directly with the student's locally stored key. The key is never sent to the app server.
2. **BYOK in Material Studio** — notes, PPT, quizzes, flashcards, whiteboard lessons and other materials use the same browser-side route.
3. **Qwen for suitable lightweight work** — local Qwen supports short grounded answers, revision notes and flashcards. Larger tasks are rejected with a clear recommendation to use Gemini rather than returning low-quality output.
4. **Central mode router** — `lib/client-ai-router.ts` enforces `byok`, `offline`, or `server` consistently.
5. **Mode enforcement** — normal Classroom, RAG Classroom, RAG questions and Material Studio now obey `gg_ai_mode`.
6. **Context compaction** — textbook extracts are cleaned and bounded before local inference to fit the 4096-token Qwen context more safely.
7. **Unfinished local vision removed from the product promise** — offline camera mode reports `unsupported`; the settings UI explains that Gemini BYOK is required for images/PDFs.
8. **Quota/failure messages** — missing key, free-tier quota/rate limit, missing local model, unsupported local task and provider failures have distinct user-facing messages.

## Routing

### BYOK mode
Gemini with student key → local Qwen fallback only for short answers, revision notes and flashcards.

### Offline mode
Local Qwen only. Large outputs such as PPT, full classroom lessons, simulations and research briefs are intentionally blocked.

### Server mode
Server Gemini → local Qwen fallback only for supported lightweight tasks.

## Important files

- `lib/client-ai-router.ts`
- `lib/client-material-generation.ts`
- `app/(student)/classroom/page.tsx`
- `app/(student)/rag-classroom/page.tsx`
- `app/(student)/material-studio/page.tsx`
- `lib/offline-ai.ts`
- `lib/student-key.ts`

## Validation

`npx tsc --noEmit` passes after locked dependencies are installed.

## Practical limitation

Qwen 3.5 0.8B is intentionally not used for long PPTs, complex quiz banks, full visual lesson planning or rigorous factual QA. Those tasks need Gemini BYOK or server mode. This is a quality safeguard, not a missing connection.
