# Gemini BYOK Multi-Key Rotation

## Behaviour

- Students can save multiple Gemini API keys in Settings/Profile.
- Keys remain only in browser localStorage and are never sent to AI Guru servers.
- All browser Gemini text, vision, streaming, search, classroom, homework, RAG, and multi-agent material calls use the shared key pool.
- When Google reports a daily quota limit, that key is marked exhausted for the current local calendar day and the next available key is tried automatically.
- Daily-exhausted keys are reset automatically on the next local calendar day.
- Temporary 429/5xx rate limits use a 60-second cooldown and rotate to another key.
- Invalid/unauthorized keys are disabled until the student removes and re-adds them.
- If no key remains, the user receives: add another key or try again tomorrow.

## Storage

- New pool: `gg_student_gemini_keys_v2`
- Original single key: `gg_student_gemini_key`
- Existing single-key users are migrated automatically.

## Streaming safety

A streaming call rotates only when the request fails before content begins. If a connection fails after partial output, the app does not restart with another key, avoiding duplicate answers.

## Security note

Keys are stored locally for BYOK convenience. Production deployment must use a strict Content Security Policy and avoid untrusted third-party scripts because page JavaScript can access localStorage.
