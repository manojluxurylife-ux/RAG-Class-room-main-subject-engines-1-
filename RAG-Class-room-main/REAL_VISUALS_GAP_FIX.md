# Real Visuals Gap Fix

## Corrected routes

### `/api/rag/lesson`
- Every scene now requests a structured `visual` object.
- Returned visuals are runtime-validated with `isValidVisual`.
- Missing or malformed AI visuals are replaced with a deterministic Mermaid flowchart.
- `/rag-classroom` renders the scene visual beside the animated whiteboard.

### `/api/material-studio/generate`
- Every generated section now requests a structured `visual` object.
- The old PPT wording "visual suggestion" was removed and replaced with a real validated visual object.
- Returned visuals are normalized and safely fall back to a rendered flowchart.
- `/material-studio` renders each section visual using `DiagramRenderer`.

## Supported real visual objects

- Function graph
- Bar chart
- Geometry
- Fraction
- Number line
- Mermaid flowchart
- 3D solid
- GeoGebra construction
- Molecule using SMILES
- Electrical circuit
- Curated biology diagram

## Validation

`npx tsc --noEmit` passed.
