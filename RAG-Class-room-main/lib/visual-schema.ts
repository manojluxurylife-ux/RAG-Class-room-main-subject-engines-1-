/**
 * Visual schema — the structured "what to draw" data the AI outputs.
 * The AI NEVER produces raw pixel/vertex coordinates — only these small,
 * checkable parameters. A deterministic renderer (components/visuals/)
 * turns each type into a correct diagram. This is the core design
 * decision behind the whole visual layer: small on-device models are
 * unreliable at spatial reasoning, but reliable at picking a type and
 * filling in a few numbers.
 *
 * Scoped to Maths today (AI Guru's actual subject). The dispatcher
 * pattern in components/visuals/DiagramRenderer.tsx is intentionally
 * generic — adding "biology-diagram" or "map" later means adding a case
 * to the switch and a renderer component, not redesigning this contract.
 */

export type VisualType =
  | "graph"        // y = f(x) plot — Chart.js
  | "bar-chart"     // categorical data — Chart.js
  | "geometry"      // triangle / circle / rectangle / polygon — Canvas
  | "fraction"      // fraction bar or pie — Canvas
  | "number-line"   // number line with marked points — Canvas
  | "flowchart"     // steps/algorithm — Mermaid
  | "solid-3d"      // cone / cylinder / sphere / cube — Three.js (mensuration)
  | "geogebra"      // interactive/draggable geometry construction — GeoGebra applet
  | "molecule"      // chemical structure from a SMILES string — smiles-drawer
  | "circuit"       // simple series circuit diagram — hand-built Canvas renderer
  | "biology-diagram" // curated cell/anatomical diagram, selected not generated
  // ---- Volume 3-8 subject visuals (lib/subject-visuals.ts) ----
  | "wave"           // Physics: transverse wave with amplitude/wavelength markers
  | "ray-diagram"    // Physics: lens/mirror principal-ray construction
  | "force-diagram"  // Physics: free-body diagram with labelled force arrows
  | "atom"           // Chemistry: Bohr model with electron shells
  | "chem-equation"  // Chemistry: balanced equation card with subscripts
  | "punnett"        // Biology: 2x2 Punnett square (monohybrid cross)
  | "india-map"      // Geography: India states map with highlights (@svg-maps/india data)
  | "timeline"       // History: horizontal event timeline
  | "logic-circuit"  // CS: logic gates (AND/OR/NOT/NAND/NOR/XOR) with wiring
  | "data-structure"; // CS: array / stack / queue / linked-list / binary-tree

export interface GraphVisual {
  type: "graph";
  expression: string;        // e.g. "x^2 - 4" — evaluated by mathjs, never eval()'d as JS
  domain: [number, number];  // e.g. [-5, 5]
  label?: string;
}

export interface BarChartVisual {
  type: "bar-chart";
  labels: string[];
  values: number[];
  label?: string;
}

export interface GeometryVisual {
  type: "geometry";
  shape: "triangle" | "circle" | "rectangle" | "right-triangle";
  // Only the numbers needed to compute the shape — never coordinates.
  sides?: [number, number, number];   // triangle: three side lengths
  legs?: [number, number];             // right-triangle: the two legs
  radius?: number;                     // circle
  width?: number; height?: number;     // rectangle
  labels?: Record<string, string>;     // e.g. {"a": "3 cm", "b": "4 cm"}
}

export interface FractionVisual {
  type: "fraction";
  numerator: number;
  denominator: number;
  style?: "bar" | "pie";
}

export interface NumberLineVisual {
  type: "number-line";
  min: number; max: number;
  points: { value: number; label?: string }[];
}

export interface FlowchartVisual {
  type: "flowchart";
  // Plain Mermaid flowchart syntax, e.g. "A[Start] --> B{n even?}"
  // The AI writes this directly — Mermaid syntax is forgiving text, not
  // coordinates, which is exactly the kind of task small models handle well.
  mermaidSyntax: string;
}

export interface Solid3DVisual {
  type: "solid-3d";
  shape: "cone" | "cylinder" | "sphere" | "cube";
  radius?: number;
  height?: number;
  side?: number;
  labels?: Record<string, string>;
}

export interface GeoGebraVisual {
  type: "geogebra";
  // Plain GeoGebra input-bar commands, e.g. "A = (0, 0)", "B = (4, 0)",
  // "Polygon(A, B, C)", "Circle(A, 5)" — a constrained, well-defined
  // command language (evaluated by GeoGebra's own applet, never raw
  // code), same principle as flowchart's Mermaid syntax above. Adopted
  // from evaluating HKUDS/DeepTutor (Apache 2.0) — their vision_solver
  // agent reads a photographed geometry figure and emits GeoGebra
  // commands directly; this is the same idea, reimplemented for our own
  // visual pipeline. Use ONLY for geometry that genuinely benefits from
  // being interactive/draggable (e.g. exploring how a triangle changes
  // as a vertex moves) — for a fixed, non-manipulable shape, the plain
  // "geometry" type above is simpler and lighter-weight.
  commands: string[];
  caption?: string;
}

export interface MoleculeVisual {
  type: "molecule";
  // A standard SMILES string (e.g. "CCO" for ethanol, "O" for water,
  // "C1=CC=CC=C1" for benzene) — a well-established, widely-used
  // chemical notation, not something invented for this app. Same
  // principle as every other visual type: the AI writes a small,
  // well-defined piece of text; a trusted, dedicated library
  // (smiles-drawer, MIT-licensed, peer-reviewed) parses and draws the
  // actual structure — the AI never supplies atom coordinates or a
  // drawing itself. Closes a real gap: Chemistry is one of this app's
  // six supported subjects but had no dedicated visual at all before this.
  smiles: string;
  caption?: string;
}

export type CircuitComponentKind = "battery" | "resistor" | "switch" | "ammeter" | "voltmeter" | "bulb";

export interface CircuitComponent {
  kind:  CircuitComponentKind;
  label?: string;   // e.g. "6V", "R1", "A"
  open?: boolean;   // switch only — true = drawn open (circuit off), default false (closed)
}

export interface CircuitVisual {
  type: "circuit";
  // Ordered left-to-right along the top of a simple series loop, e.g.
  // [{kind:"battery",label:"6V"}, {kind:"switch"}, {kind:"resistor",label:"R"}, {kind:"ammeter"}].
  // Hand-built rather than a third-party library — checked what's
  // actually available first: tscircuit is real but professional PCB/EDA
  // design software (manufacturing exports, KiCad integration), genuine
  // overkill here; circuit-diagram (npm) is deprecated;
  // react-circuit-schematics has 5 stars, one watcher, no formal
  // releases — none cleared the same bar smiles-drawer did for
  // Chemistry. Scoped honestly to simple series circuits (2-6
  // components, one loop, no branching) — this covers the actual
  // Class 9-10 CBSE need directly (matches lib/lab-kb.ts's already-
  // curated "Verifying Ohm's Law" experiment: battery, switch,
  // resistor, ammeter in series). Parallel circuits are a real,
  // separate extension, not built here.
  components: CircuitComponent[];
  caption?: string;
}

export interface BiologyDiagramVisual {
  type: "biology-diagram";
  // Not a free-form generation — the AI picks ONE id from a small,
  // curated, hand-authored set (lib/biology-diagrams.ts) matching the
  // current topic. Cell/anatomical diagrams are illustrative, not
  // reducible to a few numbers the way a circuit or molecule is —
  // asking the AI to draw one stroke-by-stroke would mean trusting it
  // to get real biology right with no way to verify. Worst case on a
  // wrong pick here is a real, correct diagram that isn't the most
  // relevant one — never an anatomically wrong diagram.
  diagramId: string;
  caption?: string;
}

export interface WaveVisual { type: "wave"; cycles?: number; amplitudeLabel?: string; wavelengthLabel?: string; caption?: string }
export interface RayDiagramVisual { type: "ray-diagram"; element: "convex-lens" | "concave-lens" | "concave-mirror" | "convex-mirror"; focalLength: number; objectDistance: number; caption?: string }
export interface ForceDiagramVisual { type: "force-diagram"; body?: string; forces: { label: string; direction: "up" | "down" | "left" | "right" | number; magnitude?: number }[]; caption?: string }
export interface AtomVisual { type: "atom"; element?: string; atomicNumber?: number; shells?: number[]; caption?: string }
export interface ChemEquationVisual { type: "chem-equation"; equation: string; caption?: string }
export interface PunnettVisual { type: "punnett"; parent1: [string, string]; parent2: [string, string]; caption?: string }
export interface IndiaMapVisual { type: "india-map"; highlight?: string[]; caption?: string }
export interface TimelineVisual { type: "timeline"; events: { year: string | number; label: string }[]; title?: string; caption?: string }
export interface LogicCircuitVisual { type: "logic-circuit"; inputs: string[]; gates: { id: string; gate: "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR"; inputs: string[] }[]; output?: string; caption?: string }
export interface DataStructureVisual { type: "data-structure"; kind: "array" | "stack" | "queue" | "linked-list" | "binary-tree"; values: (string | number)[]; caption?: string }

export type Visual =
  | GraphVisual | BarChartVisual | GeometryVisual
  | FractionVisual | NumberLineVisual | FlowchartVisual | Solid3DVisual | GeoGebraVisual | MoleculeVisual | CircuitVisual | BiologyDiagramVisual
  | WaveVisual | RayDiagramVisual | ForceDiagramVisual | AtomVisual | ChemEquationVisual | PunnettVisual
  | IndiaMapVisual | TimelineVisual | LogicCircuitVisual | DataStructureVisual;

/** Loose runtime check — used before rendering, so a malformed AI output
 *  (especially from the weaker offline model) degrades to "no diagram"
 *  instead of crashing the lesson. */
export function isValidVisual(v: any): v is Visual {
  if (!v || typeof v !== "object" || typeof v.type !== "string") return false;
  switch (v.type as VisualType) {
    case "graph":       return typeof v.expression === "string" && Array.isArray(v.domain) && v.domain.length === 2;
    case "bar-chart":   return Array.isArray(v.labels) && Array.isArray(v.values) && v.labels.length === v.values.length;
    case "geometry":    return typeof v.shape === "string";
    case "fraction":    return typeof v.numerator === "number" && typeof v.denominator === "number" && v.denominator !== 0;
    case "number-line": return typeof v.min === "number" && typeof v.max === "number" && Array.isArray(v.points);
    case "flowchart":   return typeof v.mermaidSyntax === "string" && v.mermaidSyntax.trim().length > 0;
    case "solid-3d":    return typeof v.shape === "string";
    case "geogebra":    return Array.isArray(v.commands) && v.commands.length > 0 && v.commands.every((c: any) => typeof c === "string");
    case "molecule":    return typeof v.smiles === "string" && v.smiles.trim().length > 0;
    case "circuit": {
      const validKinds = new Set(["battery", "resistor", "switch", "ammeter", "voltmeter", "bulb"]);
      return Array.isArray(v.components) && v.components.length >= 2 && v.components.length <= 6 &&
        v.components.every((c: any) => c && validKinds.has(c.kind));
    }
    case "biology-diagram": return typeof v.diagramId === "string" && v.diagramId.trim().length > 0;
    case "wave":           return true;
    case "ray-diagram":    return ["convex-lens","concave-lens","concave-mirror","convex-mirror"].includes(v.element) && Number.isFinite(v.focalLength) && Number.isFinite(v.objectDistance) && v.focalLength !== 0 && v.objectDistance !== 0;
    case "force-diagram":  return Array.isArray(v.forces) && v.forces.length > 0 && v.forces.every((f: any) => f && typeof f.label === "string");
    case "atom":           return Number.isFinite(v.atomicNumber) || (Array.isArray(v.shells) && v.shells.length > 0);
    case "chem-equation":  return typeof v.equation === "string" && v.equation.trim().length > 2;
    case "punnett":        return Array.isArray(v.parent1) && v.parent1.length === 2 && Array.isArray(v.parent2) && v.parent2.length === 2;
    case "india-map":      return v.highlight === undefined || Array.isArray(v.highlight);
    case "timeline":       return Array.isArray(v.events) && v.events.length > 0 && v.events.every((e: any) => e && typeof e.label === "string");
    case "logic-circuit":  return Array.isArray(v.inputs) && Array.isArray(v.gates) && v.gates.length > 0 && v.gates.every((g: any) => g && typeof g.id === "string" && typeof g.gate === "string" && Array.isArray(g.inputs));
    case "data-structure": return ["array","stack","queue","linked-list","binary-tree"].includes(v.kind) && Array.isArray(v.values) && v.values.length > 0;
    default:            return false;
  }
}
