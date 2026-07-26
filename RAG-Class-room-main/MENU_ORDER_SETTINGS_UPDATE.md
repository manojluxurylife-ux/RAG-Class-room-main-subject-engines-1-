# Student Menu Order and Settings Update

The student navigation now follows this order:

1. Dashboard
2. Settings
   - Gemini BYOK Keys
   - Local Model Download
   - PDF Textbook Download
   - Web Search (Gemini)
3. Material Studio
4. RAG Classroom
5. Offline Library
6. Homework
7. Practice
8. Virtual Lab
9. Exam Room
10. Library
11. Progress
12. Parent
13. Messages
14. Profile

The older top-level `Study Materials` and general `Classroom` entries were removed from the visible menu so RAG Classroom is the single classroom hub. Their source routes remain in the project and can still be linked internally where needed.

The Settings submenu links directly to anchored sections on `/settings`:

- `/settings#gemini-byok-keys`
- `/settings#local-model-download`
- `/settings#pdf-textbook-download`
- `/settings#web-search-gemini`

The menu is responsive: it remains horizontally scrollable on small screens and shows the Settings facilities in an accessible dropdown.

## Validation

- `npm ci --no-audit --no-fund`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: compilation started successfully but did not finish before the execution timeout.
