# Multi-Agent Study Material Pipeline

## Implemented workflow

1. Grounding agent prepares one compact, shared textbook packet.
2. Curriculum planner creates objectives, topic coverage, source IDs, visual needs and assessment goals.
3. Three specialist agents run in parallel:
   - Material specialist
   - Visual specialist
   - Assessment specialist
4. Grounding QA checks citations, coverage, answers and renderable visuals.
5. Repair agent corrects failed sections when the score is below 85 or QA fails.

## AI modes

- **Gemini BYOK:** all specialist calls run directly in the browser. The student's key is never sent to AI Guru's server.
- **Server:** the Next.js agent endpoint runs Gemini with the server key. The included `workers/adk-material-worker` directory provides the production Google ADK/Cloud Run implementation.
- **Offline:** Qwen 0.8B uses an agent-lite flow for supported tasks only; complex materials remain blocked.

## ADK worker

`workers/adk-material-worker` uses ADK `LlmAgent`, `ParallelAgent`, and `SequentialAgent`. Deploy it as a private Cloud Run service and call it through Cloud Tasks with OIDC.

## Validation

- TypeScript: `npx tsc --noEmit`
- Python: `python -m py_compile workers/adk-material-worker/*.py`
