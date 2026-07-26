# Firebase-Failure Material Generation

## Behaviour

Material Studio no longer treats Firestore or Cloud Tasks as a mandatory dependency for generation.

In Server mode the resilience order is:

1. Private Google ADK Cloud Run job through Firestore + Cloud Tasks.
2. If job creation, polling, Firestore, Cloud Tasks, or the worker fails: browser multi-agent generation with the student's Gemini BYOK key.
3. If no BYOK key is available: direct server specialist-agent calls, which do not use Firestore or Cloud Tasks.
4. For revision notes and flashcards only, downloaded Qwen can provide Agent-Lite as the final fallback.

Completed results are saved directly into IndexedDB and can be backed up to the student's Google Drive. No Firestore write is required for the fallback result.

## Grounding resilience

Successful textbook source packets are cached in browser local storage. If the RAG context endpoint later becomes temporarily unavailable, the same document/topic packet can be reused for generation.

## Important limitation

The first generation for a new topic still needs either a reachable RAG context endpoint or a previously cached source packet. A Gemini BYOK key is strongly recommended because it is the only full multi-agent fallback that remains independent of Firebase, Cloud Tasks, and the application Gemini key.

## Upstash

Upstash remains optional for cache, rate limiting, and temporary application data. It is not used as the authoritative ADK job store and is not required by the browser BYOK fallback.
