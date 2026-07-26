import json
import os
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from firebase_admin import initialize_app, firestore as admin_firestore
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from agent import root_agent

app = FastAPI(title="AI Guru ADK Material Worker")
initialize_app(options={"projectId": os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT_ID")})
db = admin_firestore.client()
sessions = InMemorySessionService()
runner = Runner(agent=root_agent, app_name="ai-guru-materials", session_service=sessions)

class JobRequest(BaseModel):
    jobId: str
    userId: str

def now():
    return datetime.now(timezone.utc).isoformat()

def patch(ref, **fields):
    fields["updatedAt"] = now()
    ref.set(fields, merge=True)

@app.get("/health")
def health():
    return {"ok": True, "agent": root_agent.name}

@app.post("/process")
async def process(job: JobRequest, request: Request):
    ref = db.collection("adkMaterialJobs").document(job.jobId)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "Job not found")
    record = snap.to_dict() or {}
    if record.get("ownerId") != job.userId:
        raise HTTPException(403, "Job owner mismatch")
    if record.get("status") == "completed":
        return {"jobId": job.jobId, "status": "completed", "duplicate": True}
    if record.get("status") == "processing":
        lock_raw = record.get("lockExpiresAt")
        try:
            lock_until = datetime.fromisoformat(lock_raw) if isinstance(lock_raw, str) else None
        except ValueError:
            lock_until = None
        if lock_until and lock_until > datetime.now(timezone.utc):
            # A concurrent delivery must fail so Cloud Tasks retries later rather than
            # acknowledging and potentially losing a job whose first worker crashes.
            raise HTTPException(409, "Job is already being processed")

    prompt = record.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        patch(ref, status="failed", stage="invalid_job", progress=0, error="Job prompt is missing", completedAt=now())
        raise HTTPException(400, "Job prompt is missing")

    patch(
        ref,
        status="processing",
        stage="adk_started",
        progress=15,
        startedAt=record.get("startedAt") or now(),
        lockExpiresAt=(datetime.now(timezone.utc) + timedelta(minutes=35)).isoformat(),
        error=None,
    )
    try:
        await sessions.create_session(app_name="ai-guru-materials", user_id=job.userId, session_id=job.jobId)
        message = types.Content(role="user", parts=[types.Part(text=prompt)])
        final_text = None
        event_count = 0
        async for event in runner.run_async(user_id=job.userId, session_id=job.jobId, new_message=message):
            event_count += 1
            # ADK emits events as the sequential/parallel workflow advances.
            progress = min(88, 15 + event_count * 9)
            patch(ref, stage="adk_agents_running", progress=progress)
            if event.is_final_response() and event.content and event.content.parts:
                final_text = event.content.parts[0].text
        if not final_text:
            raise RuntimeError("ADK returned no final material")
        try:
            parsed = json.loads(final_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"ADK final output was not valid JSON: {exc}") from exc
        result = parsed.get("material", parsed) if isinstance(parsed, dict) else parsed
        if not isinstance(result, dict) or not isinstance(result.get("sections"), list):
            raise RuntimeError("ADK final output is missing material sections")
        patch(ref, status="completed", stage="completed", progress=100, result=result, completedAt=now(), lockExpiresAt=None)
        return {"jobId": job.jobId, "status": "completed"}
    except Exception as exc:
        patch(ref, status="failed", stage="failed", progress=0, error=str(exc), completedAt=now(), lockExpiresAt=None)
        raise HTTPException(500, str(exc))
