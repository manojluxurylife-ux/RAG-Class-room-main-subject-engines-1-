# Generate First, Render During Teaching

## What changed

Study-material generation can now store a `visualizationPlan` on each segment. The plan contains 2–4 deterministic phases generated from the uploaded textbook source. Each phase has a title, short teacher narration, a teaching-line reveal threshold, and one validated visual specification.

During the Study Material Classroom, `LiveVisualizationPlayer` reveals those phases as the text is taught. It supports autoplay, pause, restart, previous, and next controls. The existing `DiagramRenderer` selects the actual renderer: Chart.js/mathjs, Canvas, Mermaid, Three.js, GeoGebra, smiles-drawer, circuit canvas, or curated biology diagrams.

Older materials containing only the former `visual` field remain compatible and are automatically wrapped as a one-phase teaching plan.

## Data shape

```json
{
  "visualizationPlan": {
    "mode": "during-teaching",
    "autoplay": true,
    "phaseDurationMs": 2800,
    "phases": [
      {
        "title": "Introduce the shape",
        "narration": "Observe the two perpendicular sides.",
        "revealAfterLine": 0,
        "visual": { "type": "geometry", "shape": "right-triangle", "legs": [3, 4] }
      }
    ]
  }
}
```

## Files added

- `lib/visualization-plan.ts`
- `components/visuals/LiveVisualizationPlayer.tsx`

## Files updated

- `lib/study-material-schema.ts`
- `lib/content-generators.ts`
- `app/(student)/classroom/study/[id]/page.tsx`
- `lib/study-material-qa.ts`

## Validation

`npx tsc --noEmit` passes after restoring the locked npm dependencies.
