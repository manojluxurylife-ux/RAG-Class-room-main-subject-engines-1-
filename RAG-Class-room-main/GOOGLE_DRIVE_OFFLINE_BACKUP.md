# Google Drive backup for offline materials

## Behaviour

1. Gemini or the multi-agent pipeline generates a study material while online.
2. The structured output is saved in IndexedDB for immediate offline replay.
3. In **Student Portal → Offline Library**, the student selects **Save to Drive**.
4. AI Guru creates a portable `.aiguru.json` package containing the material, visuals, quizzes, whiteboard instructions, QA metadata, and cached textbook file when available.
5. On another device, the student opens Offline Library, selects **Connect Drive**, and downloads the package.
6. The package is validated and imported into IndexedDB. It then runs without internet.

## Privacy and OAuth

The browser uses Google Identity Services and the `drive.file` scope. AI Guru can list and download only files created by AI Guru. The short-lived OAuth access token is retained only in browser memory and is not sent to the AI Guru server or Firestore.

## Required configuration

Create a Google OAuth 2.0 Web Client in Google Cloud Console, enable Google Drive API, add the deployed application URL to Authorized JavaScript origins, and set:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
```

Add localhost as an authorized origin for local development.

## Package format

MIME type: `application/vnd.ai-guru.offline-material+json`

Drive files carry an app property marker so the app can locate its own backups. Cached textbook blobs are encoded inside the portable package, which can increase Drive file size.

## Limits

- The student must be online to upload to or download from Drive.
- After restoration, internet is not required.
- Clearing browser data removes the device copy but not the Drive backup.
- `drive.file` cannot discover backups uploaded manually outside AI Guru unless they were created by this app.
