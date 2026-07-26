# Separate Teaching and Study-Material Languages

## Purpose
Students can learn from an English textbook through Malayalam explanations while keeping examination materials in English.

## Preferences
- `sourceLanguage`: language of the uploaded textbook.
- `teachingLanguage`: language used for classroom narration, explanations, and doubt clearing.
- `materialLanguage`: language used for notes, PPT text, MCQs, quizzes, flashcards, answer keys, and exam practice.
- `teachingStyle`: target language only, target language with English technical terms, or simple English.

## Example
- Textbook: English
- Teaching: Malayalam
- Materials: English
- Style: Malayalam with English technical terms

The AI may narrate: "ഇവിടെ coefficient of x ഒരുപോലെ ആക്കണം. അതിനുശേഷം equations subtract ചെയ്യാം."

The whiteboard and exam materials remain:

```
2x + 3y = 110
2x + 5y = 170
```

## Integrated areas
- Student profile defaults
- RAG Classroom session controls
- Classroom narration and browser TTS locale
- Textbook-grounded doubt answers
- Material Studio multi-agent prompts
- Revision notes, slides, flashcards, and quiz tabs
- Offline material records and Google Drive portable backups through embedded language metadata

## Validation
- `npm ci`: passed
- `npx tsc --noEmit`: passed
- `next build`: optimization did not complete within the execution environment timeout; no TypeScript errors were reported.
