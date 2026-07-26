# Managed Server AI deactivated

The current release exposes only:

1. **Gemini BYOK** — default material generation path. The user's key stays in the browser.
2. **Offline Qwen** — supported local tasks and replay of downloaded materials.

Managed Gemini, Cloud Tasks, and the ADK Cloud Run worker remain in the repository but are disabled behind two flags:

```env
NEXT_PUBLIC_ENABLE_SERVER_AI=false
ENABLE_SERVER_AI=false
```

Both must be set to `true` to reactivate the Server selector and server endpoints. With either flag false:

- Existing `server` selections are automatically migrated to `byok`.
- The Server Mode card is hidden.
- ADK job and direct server-agent endpoints return HTTP 503.
- Material generation does not call the app owner's Gemini key.
- BYOK is the default; Offline is the only alternative.

Before reactivation, deploy the private ADK worker, configure Cloud Tasks and Firestore, and add billing/quota controls.
