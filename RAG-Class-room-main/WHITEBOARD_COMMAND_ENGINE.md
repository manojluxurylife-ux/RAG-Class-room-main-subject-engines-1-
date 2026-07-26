# Whiteboard Command Engine

## Purpose

AI Guru Brain2 now stores executable whiteboard instructions instead of relying only on static board bullet points.

## Supported commands

- `write` — progressively reveals teacher-style text/equations
- `pause` — inserts a natural teaching pause
- `underline` — animates an underline under a prior command
- `circle` — circles an important result
- `arrow` — draws an arrow between two board items
- `laser` — moves a red laser marker to a board item
- `erase` — removes a selected board item
- `clear` — clears the complete board

## Example

```json
{
  "version": 1,
  "autoplay": true,
  "commands": [
    {"id":"eq1","action":"write","text":"2x + 3y = 110","durationMs":1800},
    {"action":"pause","durationMs":500},
    {"action":"underline","target":"eq1","durationMs":700},
    {"id":"eq2","action":"write","text":"2x + 5y = 170","durationMs":1800},
    {"action":"arrow","from":"eq2","to":"eq1","durationMs":700},
    {"action":"circle","target":"eq2","durationMs":700},
    {"action":"laser","target":"eq1","durationMs":900}
  ]
}
```

## Integration

- `/api/rag/lesson` requests and validates command plans for every lesson scene.
- RAG Classroom executes commands with the Konva-based `WhiteboardCommandEngine`.
- Material Studio and the browser multi-agent pipeline store command plans in material sections.
- Older lessons with only `board: string[]` are converted automatically into sequential `write` and `pause` commands.

## Classroom controls

The board player includes:

- Play/pause
- Replay
- Writing-speed selector
- Step progress

Starting narration restarts the board timeline. Pausing narration pauses the board timeline.

## Rendering note

Arbitrary English and Malayalam text is progressively rendered in the Kalam handwriting font. Underlines, circles, arrows, and laser movements are true animated canvas strokes. This is a practical handwriting-style implementation; it does not contain a handcrafted pen-stroke alphabet for every Unicode character.
