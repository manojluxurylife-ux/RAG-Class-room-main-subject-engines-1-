# Google ADK Cloud Tasks connection

Server AI mode now uses this production path:

1. Material Studio retrieves the signed-in student's grounded textbook extracts.
2. `POST /api/material-studio/adk-jobs` creates `adkMaterialJobs/{jobId}` in Firestore.
3. The API enqueues an authenticated Cloud Task containing only `jobId` and `userId`.
4. Cloud Tasks invokes the private Cloud Run worker at `/process` with an OIDC token.
5. The worker verifies the Firestore owner, obtains the prompt from Firestore, and runs:
   - curriculum planner;
   - content, visual, and assessment agents in parallel;
   - strict grounding QA;
   - conditional repair and final merge.
6. The worker writes progress, failure details, or the completed material to Firestore.
7. Material Studio polls its owner-protected status route, renders the result, saves it to IndexedDB, and can back it up to Google Drive.

BYOK mode remains browser-side, so student Gemini keys never go to the server. Offline mode remains Qwen Agent-Lite.

## Google Cloud setup

```bash
gcloud services enable run.googleapis.com cloudtasks.googleapis.com firestore.googleapis.com aiplatform.googleapis.com

gcloud tasks queues create ai-guru-materials --location=asia-south1

gcloud iam service-accounts create ai-guru-task-invoker
```

Deploy the worker from `workers/adk-material-worker`:

```bash
gcloud run deploy ai-guru-adk-material-worker \
  --source workers/adk-material-worker \
  --region asia-south1 \
  --no-allow-unauthenticated \
  --timeout 3600 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars GEMINI_ADK_MODEL=gemini-2.5-flash
```

Grant the task service account permission to invoke the worker:

```bash
gcloud run services add-iam-policy-binding ai-guru-adk-material-worker \
  --region asia-south1 \
  --member serviceAccount:ai-guru-task-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role roles/run.invoker
```

The service account used by the Next.js server needs `roles/cloudtasks.enqueuer` and `roles/iam.serviceAccountUser` for the task-invoker account. The Cloud Run worker service account needs Firestore read/write access and permission to call Gemini/Vertex AI.

Set the application environment variables listed in `.env.example`. `ADK_WORKER_URL` must be the deployed Cloud Run service URL without `/process`.

## Retry safety

Cloud Tasks has a 30-minute dispatch deadline. Firestore records include a processing lease. Duplicate deliveries cannot process the same job concurrently, and expired leases can be retried. Completed jobs are idempotently acknowledged.
