# Google Cloud + Firestore production integration

## Added
- Firestore remains the server-side source of truth when Google Cloud credentials are configured.
- Cloud Storage uploads now use CRC32C validation, private cache headers, and owner/source object metadata.
- Personal study-material routes verify the signed session owner before read or mutation.
- Generation records include processing stage, attempt count, request ID, timestamps, and last failure.
- Admin-only `GET /api/admin/cloud-health` verifies Firestore read/write, bucket existence, and session-secret strength.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, and `.env.example` are included.

## Deploy
1. Create Firestore in Native mode and a private GCS bucket.
2. Give the server service account `Cloud Datastore User` and `Storage Object Admin` on the selected project/bucket.
3. Configure the environment variables in `.env.example`.
4. Deploy rules/indexes with Firebase CLI: `firebase deploy --only firestore`.
5. Log in as admin and call `/api/admin/cloud-health`.

## Important security note
The application currently accesses Firestore through Firebase Admin SDK on the server. Admin SDK bypasses Firestore Security Rules, so server-side `requireRole` and ownership checks remain mandatory. The supplied rules protect any future direct browser/mobile Firebase SDK access.

## Background processing
The app now stores retry-safe processing state, but generation is still initiated through Next.js API requests. For large full textbooks, move continuation calls to Cloud Tasks or Pub/Sub/Cloud Run so jobs can continue beyond a serverless request timeout.
