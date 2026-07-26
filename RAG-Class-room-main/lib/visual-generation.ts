import { isValidVisual, type Visual } from "@/lib/visual-schema";

/**
 * RECONCILED VERSION — this module previously required a "visual" field
 * on every single scene/section, which is more robust (nothing ever
 * silently missing) but meant every lesson showed a diagram even for
 * scenes with no natural visual (e.g. a pure discussion prompt), which
 * gets repetitive fast across a whole app. Confirmed by a real test run:
 * the mandatory version was generating meaningless auto-flowcharts that
 * just wrapped raw paragraph text in boxes — diagram-shaped noise, not
 * an actual visual aid.
 *
 * This version keeps the important guarantee — a visual that IS present
 * is always validated server-side, and a malformed one never reaches
 * DiagramRenderer as broken JSON — but stops forcing a visual onto scenes
 * that never asked for one. The distinction that matters:
 *   - AI omitted "visual" entirely            -> stays omitted, no diagram
 *   - AI included "visual" but it's malformed -> deterministic fallback,
 *     so a broken AI response still never breaks the renderer
 */
/**
 * Subject-aware visual guidance. The full VISUAL_SCHEMA_LIST above works
 * for any subject, but leaves the model to infer purely from content
 * which of ~19 renderer types fits best. Steering it toward the
 * subject's own natural visual library (set once, at upload time, in
 * Material Studio) makes that choice far more reliable — a Physics
 * textbook should reach for wave/ray-diagram/force-diagram/circuit
 * without having to rediscover that fit from scratch on every section.
 *
 * Deliberately a HINT, not a restriction: the closing sentence always
 * allows any validated type when it genuinely fits better (e.g. a
 * Physics chapter with a data table still wants bar-chart).
 */
const SUBJECT_VISUAL_PRIORITY: Record<string, string[]> = {
  "mathematics":      ["graph", "geometry", "fraction", "number-line", "bar-chart", "solid-3d", "geogebra"],
  "physics":          ["wave", "ray-diagram", "force-diagram", "circuit", "graph"],
  "chemistry":        ["atom", "chem-equation", "molecule"],
  "biology":          ["biology-diagram", "punnett"],
  "science":          ["wave", "atom", "chem-equation", "biology-diagram", "punnett", "circuit", "molecule", "graph"],
  "social science":   ["india-map", "timeline", "bar-chart", "flowchart"],
  "computer science": ["logic-circuit", "data-structure", "flowchart"],
  "english":          ["flowchart", "timeline"],
};

export function subjectVisualGuidance(subject?: string | null): string {
  const key = (subject || "").trim().toLowerCase();
  const priority = SUBJECT_VISUAL_PRIORITY[key];
  if (!priority) return "";
  return ` This is a ${subject} textbook — when a section needs a visual, reach first for these renderers if the content supports them: ${priority.join(", ")}. Any other validated visual type from the list is still fine when it genuinely fits a section better than these do.`;
}

export const VISUAL_SCHEMA_LIST = `Use exactly one of these validated visual objects (never descriptive prose, never SVG/HTML/JavaScript/pixel coordinates/image URLs):
- {"type":"graph","expression":"x^2 - 4","domain":[-5,5],"label":"..."}
- {"type":"bar-chart","labels":["A","B"],"values":[1,2],"label":"..."}
- {"type":"geometry","shape":"triangle|circle|rectangle|right-triangle","sides":[3,4,5],"legs":[3,4],"radius":3,"width":4,"height":2,"labels":{"a":"3 cm"}}
- {"type":"fraction","numerator":1,"denominator":2,"style":"bar|pie"}
- {"type":"number-line","min":-5,"max":5,"points":[{"value":0,"label":"zero"}]}
- {"type":"flowchart","mermaidSyntax":"flowchart TD\\nA[Start] --> B[Next step]"}
- {"type":"solid-3d","shape":"cone|cylinder|sphere|cube","radius":2,"height":4,"side":3,"labels":{}}
- {"type":"geogebra","commands":["A=(0,0)","B=(4,0)","C=(0,3)","Polygon(A,B,C)"],"caption":"..."}
- {"type":"molecule","smiles":"CCO","caption":"Ethanol"}
- {"type":"circuit","components":[{"kind":"battery","label":"6V"},{"kind":"resistor","label":"R"}],"caption":"..."}
- {"type":"biology-diagram","diagramId":"plant-cell|animal-cell|neuron|heart","caption":"..."}
- {"type":"wave","cycles":2,"amplitudeLabel":"A","wavelengthLabel":"λ","caption":"..."} (Physics: transverse wave)
- {"type":"ray-diagram","element":"convex-lens|concave-lens|concave-mirror|convex-mirror","focalLength":10,"objectDistance":25,"caption":"..."} (Physics: image formation; distances in cm)
- {"type":"force-diagram","body":"Block","forces":[{"label":"Weight W","direction":"down","magnitude":50},{"label":"Normal N","direction":"up","magnitude":50}],"caption":"..."} (Physics: free-body; direction is up|down|left|right or an angle in degrees)
- {"type":"atom","element":"Na","atomicNumber":11,"caption":"..."} (Chemistry: Bohr model, Z up to 20, or give explicit "shells":[2,8,1])
- {"type":"chem-equation","equation":"2H2 + O2 -> 2H2O","caption":"..."} (Chemistry: use -> or <-> ; plain ASCII formulas)
- {"type":"punnett","parent1":["T","t"],"parent2":["T","t"],"caption":"..."} (Biology: monohybrid cross)
- {"type":"india-map","highlight":["Kerala","Tamil Nadu"],"caption":"..."} (Geography: highlight states by name)
- {"type":"timeline","title":"...","events":[{"year":1857,"label":"First War of Independence"},{"year":1947,"label":"Independence"}],"caption":"..."} (History: 2-10 events)
- {"type":"logic-circuit","inputs":["A","B"],"gates":[{"id":"G1","gate":"AND","inputs":["A","B"]}],"output":"G1","caption":"..."} (CS: gates AND|OR|NOT|NAND|NOR|XOR|XNOR)
- {"type":"data-structure","kind":"array|stack|queue|linked-list|binary-tree","values":[10,20,30],"caption":"..."} (CS)
Choose the closest real renderer for the concept. Do not write "visual suggestion" text. Do not output SVG, HTML, JavaScript, pixel coordinates, or image URLs.`;

/** Conservative variant for standalone materials (notes, flashcards) —
 *  a visual is the exception, not the rule. */
export const VISUAL_JSON_INSTRUCTION = `
OPTIONAL VISUAL — include a "visual" field on a scene/section ONLY if a diagram would genuinely help that specific one (skip it entirely for scenes/sections with no natural visual, like a pure discussion prompt or a plain definition). At most 1-2 scenes/sections in the whole lesson or material should have one.
When you do include one: ${VISUAL_SCHEMA_LIST}`;

/**
 * Lesson-strength variant for the RAG classroom and other taught lessons.
 * WHY this exists: lessons were previously generated with the
 * conservative instruction above, whose "at most 1-2 in the whole
 * lesson" cap directly contradicted the whiteboard-first prompt's
 * "include a visual whenever the content supports one" — and models
 * resolved that conflict by including none. One authoritative
 * instruction, one frequency rule.
 */
export const LESSON_VISUAL_INSTRUCTION = `
VISUALS — a classroom lesson should genuinely LOOK like a lesson. Include a "visual" field on EVERY scene whose textbook content is visualizable: any graph or function, geometric figure, fraction, number line, data comparison, process/flow, circuit, molecule, or cell/organ structure. A normal lesson on such content has 2-4 visuals; only a lesson with no visualizable content at all may have zero. Never attach a visual to a pure discussion prompt, and never invent a picture the textbook extracts do not support. Omit the "visual" field entirely when skipping — never send an empty object {}.
${VISUAL_SCHEMA_LIST}`;

function safeLabel(text: string) {
  return text.replace(/[\[\]{}()<>"']/g, "").replace(/\s+/g, " ").trim().slice(0, 54) || "Key idea";
}

export function fallbackVisual(title: string, points: string[] = []): Visual {
  const labels = [title, ...points].map(safeLabel).filter(Boolean).slice(0, 4);
  const nodes = labels.length ? labels : ["Topic", "Explanation", "Check understanding"];
  const declarations = nodes.map((label, i) => `${String.fromCharCode(65 + i)}[${label}]`);
  const edges = nodes.slice(0, -1).map((_, i) => `${String.fromCharCode(65 + i)} --> ${String.fromCharCode(66 + i)}`);
  return { type: "flowchart", mermaidSyntax: ["flowchart TD", ...declarations, ...edges].join("\n") };
}

/**
 * Returns undefined if no visual was ever offered (the common, expected
 * case for most scenes/sections) — only synthesizes a deterministic
 * fallback when the AI attempted one but got the shape wrong, so a
 * malformed response still never reaches DiagramRenderer as broken data.
 */
export function normalizeVisual(value: unknown, title: string, points: string[] = []): Visual | undefined {
  if (value === undefined || value === null) return undefined;
  return isValidVisual(value) ? value : fallbackVisual(title, points);
}

function withVisual<T extends Record<string, any>>(obj: T, visual: Visual | undefined): T {
  if (visual === undefined) {
    const { visual: _drop, ...rest } = obj;
    return rest as T;
  }
  return { ...obj, visual };
}

export function normalizeLessonVisuals(lesson: any) {
  if (!lesson || !Array.isArray(lesson.scenes)) return lesson;
  return {
    ...lesson,
    scenes: lesson.scenes.map((scene: any, index: number) =>
      withVisual(scene, normalizeVisual(scene?.visual, scene?.title || `Scene ${index + 1}`, Array.isArray(scene?.board) ? scene.board : [])),
    ),
  };
}

export function normalizeMaterialVisuals(material: any) {
  if (!material || !Array.isArray(material.sections)) return material;
  return {
    ...material,
    sections: material.sections.map((section: any, index: number) =>
      withVisual(section, normalizeVisual(section?.visual, section?.heading || `Section ${index + 1}`, [section?.content || ""])),
    ),
  };
}
