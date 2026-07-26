/**
 * Subject visuals — Volumes 3-8 (Physics, Chemistry, Biology, Geography,
 * Language, History/Civics/CS) for students up to Standard 12.
 *
 * Same design contract as every other visual in this app: the AI outputs
 * a few small, checkable parameters (never coordinates, never drawings);
 * a deterministic renderer here turns them into a correct diagram.
 * Same engineering pattern as lib/flowchart-renderer.ts: pure functions
 * returning SVG strings — zero dependencies, synchronous, unit-testable,
 * a few KB total. (Checked GitHub/npm first: no maintained lightweight
 * library exists for school ray-optics/Bohr/Punnett/logic-gate diagrams;
 * the one genuine find was @svg-maps/india — pure state path data,
 * ~380 KB, consumed by renderIndiaMap below rather than pulling in a
 * whole map framework.)
 *
 * Volume coverage map (what renders what):
 *   Physics    — wave, ray-diagram, force-diagram (+ existing circuit, graph)
 *   Chemistry  — atom (Bohr), chem-equation (+ existing molecule)
 *   Biology    — punnett (+ existing biology-diagram set)
 *   Geography  — india-map (+ bar-chart for climate data, flowchart for cycles)
 *   Language   — flowchart covers sentence/grammar trees; the Malayalam
 *                alphabet stroke board already exists in the classroom
 *   History/Civics/CS — timeline; flowchart covers civics org charts;
 *                logic-circuit and data-structure cover CS
 */
import { CHALKBOARD_THEME as T } from "@/lib/flowchart-renderer";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "Work Sans, sans-serif";

function frame(width: number, height: number, body: string, caption?: string): string {
  const capH = caption ? 24 : 0;
  const cap = caption
    ? `<text x="${width / 2}" y="${height + 14}" text-anchor="middle" font-size="12" fill="${T.line}">${esc(caption)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + capH}" width="${width}" height="${height + capH}" role="img" font-family="${FONT}">${body}${cap}</svg>`;
}

/* ------------------------- Physics: wave ------------------------- */

export interface WaveSpec { cycles?: number; amplitudeLabel?: string; wavelengthLabel?: string; caption?: string }

export function renderWave(spec: WaveSpec = {}): string {
  const W = 420, H = 180, midY = H / 2, amp = 52;
  const cycles = Math.max(1, Math.min(6, Math.round(spec.cycles ?? 2)));
  const wl = W / (cycles + 0.5);
  let d = `M 0 ${midY}`;
  const steps = 240;
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * W;
    const y = midY - amp * Math.sin((2 * Math.PI * x) / wl);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const crest1 = wl / 4, crest2 = crest1 + wl;
  const body =
    `<line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="${T.line}" stroke-width="1" stroke-dasharray="4 4"/>`
    + `<path d="${d}" fill="none" stroke="${T.border}" stroke-width="2.5"/>`
    // amplitude marker
    + `<line x1="${crest1}" y1="${midY}" x2="${crest1}" y2="${midY - amp}" stroke="${T.text}" stroke-width="1.5" marker-end="url(#sv-arr)"/>`
    + `<text x="${crest1 + 6}" y="${midY - amp / 2}" font-size="13" fill="${T.text}">${esc(spec.amplitudeLabel || "A (amplitude)")}</text>`
    // wavelength marker between successive crests
    + `<line x1="${crest1}" y1="${midY - amp - 14}" x2="${crest2}" y2="${midY - amp - 14}" stroke="${T.text}" stroke-width="1.5" marker-start="url(#sv-arr)" marker-end="url(#sv-arr)"/>`
    + `<text x="${(crest1 + crest2) / 2}" y="${midY - amp - 20}" text-anchor="middle" font-size="13" fill="${T.text}">${esc(spec.wavelengthLabel || "λ (wavelength)")}</text>`;
  return frame(W, H, defs() + body, spec.caption);
}

function defs(): string {
  return `<defs><marker id="sv-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${T.text}"/></marker><marker id="sv-arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${T.border}"/></marker></defs>`;
}

/* ---------------------- Physics: ray diagram ---------------------- */

export type OpticalElement = "convex-lens" | "concave-lens" | "concave-mirror" | "convex-mirror";
export interface RaySpec { element: OpticalElement; focalLength: number; objectDistance: number; caption?: string }

/**
 * Standard-10/12 principal-ray construction. Works in magnitudes with the
 * usual textbook conventions; the image position/size/orientation comes
 * from the lens/mirror formula, so the drawing is physically correct for
 * the given u and f.
 */
export function renderRayDiagram(spec: RaySpec): string {
  const W = 460, H = 240, axisY = H / 2, cx = W / 2;
  const f = Math.abs(spec.focalLength) || 10;
  const u = Math.abs(spec.objectDistance) || 20;
  const scale = Math.min(90 / f, 180 / (u + f)); // px per cm, keep in frame
  const F = f * scale, U = u * scale;
  const objH = 46;
  const isLens = spec.element.includes("lens");
  const converging = spec.element === "convex-lens" || spec.element === "concave-mirror";

  // image distance v (magnitudes) and nature
  let v: number, virtual: boolean, inverted: boolean;
  if (converging) {
    if (u > f) { v = (u * f) / (u - f); virtual = false; inverted = true; }
    else { v = (u * f) / (f - u); virtual = true; inverted = false; }
  } else { v = (u * f) / (u + f); virtual = true; inverted = false; }
  const mag = v / u;
  const V = Math.min(v * scale, W / 2 - 16);
  const imgH = Math.min(objH * mag, H / 2 - 24);

  // element drawing
  const elH = 78;
  let element: string;
  if (isLens) {
    const bulge = spec.element === "convex-lens" ? 14 : -12;
    element = `<path d="M ${cx} ${axisY - elH} Q ${cx + bulge} ${axisY} ${cx} ${axisY + elH} Q ${cx - bulge} ${axisY} ${cx} ${axisY - elH} Z" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>`;
  } else {
    const curve = spec.element === "concave-mirror" ? -16 : 16;
    element = `<path d="M ${cx} ${axisY - elH} Q ${cx + curve} ${axisY} ${cx} ${axisY + elH}" fill="none" stroke="${T.border}" stroke-width="3"/>`
      + Array.from({ length: 7 }, (_, i) => {
          const y = axisY - elH + (i + 0.5) * (2 * elH / 7);
          const xq = cx + curve * (1 - ((y - axisY) / elH) ** 2) * 0.5;
          return `<line x1="${xq}" y1="${y}" x2="${xq + 8}" y2="${y - 7}" stroke="${T.border}" stroke-width="1"/>`;
        }).join("");
  }

  // axis + F/2F ticks
  const ticks = [[-2 * F, "2F"], [-F, "F"], [F, "F"], [2 * F, "2F"]].map(([off, lab]) =>
    `<line x1="${cx + +off}" y1="${axisY - 4}" x2="${cx + +off}" y2="${axisY + 4}" stroke="${T.text}" stroke-width="1.2"/>`
    + `<text x="${cx + +off}" y="${axisY + 18}" text-anchor="middle" font-size="11" fill="${T.line}">${lab}</text>`).join("");

  const objX = cx - U;
  const imgSide = (isLens ? (virtual ? -1 : 1) : (virtual ? 1 : -1));
  const imgX = cx + imgSide * V;
  const imgTipY = inverted ? axisY + imgH : axisY - imgH;

  // principal rays: (1) parallel then refracted/reflected toward image tip,
  // (2) through optical centre / pole, undeviated (lens) or reflected (mirror).
  const tipY = axisY - objH;
  const dash = `stroke-dasharray="5 4"`;
  const ray = (x1: number, y1: number, x2: number, y2: number, dashed = false) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${T.border}" stroke-width="1.6" ${dashed ? dash : ""} marker-end="url(#sv-arr-amber)"/>`;
  let rays = ray(objX, tipY, cx, tipY);                          // parallel to axis
  rays += ray(cx, tipY, imgX, imgTipY, virtual);                 // toward/away from image tip
  rays += ray(objX, tipY, cx, axisY);                            // toward centre/pole
  rays += ray(cx, axisY, imgX, imgTipY, virtual);                // continue/reflect
  if (virtual) rays += `<line x1="${cx}" y1="${tipY}" x2="${imgX}" y2="${imgTipY}" stroke="${T.line}" stroke-width="1" ${dash}/>`;

  const arrow = (x: number, fromY: number, toY: number, color: string, dashed = false) =>
    `<line x1="${x}" y1="${fromY}" x2="${x}" y2="${toY}" stroke="${color}" stroke-width="2.5" ${dashed ? dash : ""} marker-end="url(#sv-arr)"/>`;

  const nature = `${virtual ? "Virtual" : "Real"}, ${inverted ? "inverted" : "erect"}, ${mag > 1.02 ? "magnified" : mag < 0.98 ? "diminished" : "same size"}`;
  const body = defs()
    + `<line x1="8" y1="${axisY}" x2="${W - 8}" y2="${axisY}" stroke="${T.line}" stroke-width="1.2"/>`
    + ticks + element + rays
    + arrow(objX, axisY, tipY, T.text)
    + `<text x="${objX}" y="${tipY - 8}" text-anchor="middle" font-size="12" fill="${T.text}">Object</text>`
    + arrow(imgX, axisY, imgTipY, T.text, virtual)
    + `<text x="${imgX}" y="${imgTipY + (inverted ? 16 : -8)}" text-anchor="middle" font-size="12" fill="${T.text}">Image</text>`
    + `<text x="${W / 2}" y="16" text-anchor="middle" font-size="12" fill="${T.line}">${esc(nature)} · f=${f}cm, u=${u}cm, v=${v.toFixed(1)}cm</text>`;
  return frame(W, H, body, spec.caption);
}

/* -------------------- Physics: free-body forces -------------------- */

export interface ForceSpec { body?: string; forces: { label: string; direction: "up" | "down" | "left" | "right" | number; magnitude?: number }[]; caption?: string }

export function renderForceDiagram(spec: ForceSpec): string {
  const W = 360, H = 300, cx = W / 2, cy = H / 2, box = 66;
  const dirDeg = (d: ForceSpec["forces"][0]["direction"]): number =>
    d === "up" ? -90 : d === "down" ? 90 : d === "left" ? 180 : d === "right" ? 0 : Number(d) * -1;
  const maxMag = Math.max(...spec.forces.map(f => Math.abs(f.magnitude ?? 1)), 1);
  const arrows = spec.forces.slice(0, 8).map(f => {
    const a = (dirDeg(f.direction) * Math.PI) / 180;
    const len = 55 + 55 * (Math.abs(f.magnitude ?? maxMag) / maxMag);
    const sx = cx + Math.cos(a) * (box / 2), sy = cy + Math.sin(a) * (box / 2);
    const ex = cx + Math.cos(a) * (box / 2 + len), ey = cy + Math.sin(a) * (box / 2 + len);
    const lx = cx + Math.cos(a) * (box / 2 + len + 20), ly = cy + Math.sin(a) * (box / 2 + len + 20);
    const text = f.magnitude !== undefined ? `${f.label} = ${f.magnitude} N` : f.label;
    return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${T.border}" stroke-width="2.5" marker-end="url(#sv-arr-amber)"/>`
      + `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="12.5" fill="${T.text}">${esc(text)}</text>`;
  }).join("");
  const body = defs()
    + `<rect x="${cx - box / 2}" y="${cy - box / 2}" width="${box}" height="${box}" rx="6" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>`
    + `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="${T.text}">${esc(spec.body || "Body")}</text>`
    + arrows;
  return frame(W, H, body, spec.caption);
}

/* ---------------------- Chemistry: Bohr atom ---------------------- */

export interface AtomSpec { element?: string; atomicNumber?: number; shells?: number[]; caption?: string }

const SHELL_FILL = [2, 8, 8, 2]; // simple K L M N filling taught up to Z=20

export function shellsForZ(z: number): number[] {
  const shells: number[] = [];
  let left = Math.max(1, Math.min(20, Math.round(z)));
  for (const cap of SHELL_FILL) {
    if (left <= 0) break;
    shells.push(Math.min(cap, left));
    left -= cap;
  }
  return shells;
}

export function renderAtom(spec: AtomSpec): string {
  const shells = (spec.shells && spec.shells.length ? spec.shells : shellsForZ(spec.atomicNumber ?? 1)).slice(0, 4);
  const W = 320, H = 320, cx = W / 2, cy = H / 2;
  const rings = shells.map((count, i) => {
    const r = 52 + i * 34;
    const electrons = Array.from({ length: Math.max(0, Math.min(18, Math.round(count))) }, (_, e) => {
      const a = (e / Math.max(1, Math.round(count))) * 2 * Math.PI - Math.PI / 2;
      return `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="5" fill="${T.border}"/>`;
    }).join("");
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.line}" stroke-width="1" stroke-dasharray="3 4"/>` + electrons
      + `<text x="${cx + r + 8}" y="${cy - 4}" font-size="10" fill="${T.line}">${"KLMN"[i]}</text>`;
  }).join("");
  const conf = shells.join(", ");
  const body = rings
    + `<circle cx="${cx}" cy="${cy}" r="26" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>`
    + `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="16" font-weight="700" fill="${T.text}">${esc(spec.element || "")}</text>`
    + (spec.atomicNumber ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" fill="${T.line}">Z=${spec.atomicNumber}</text>` : "")
    + `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="12" fill="${T.text}">Electron configuration: ${esc(conf)}</text>`;
  return frame(W, H, body, spec.caption);
}

/* -------------------- Chemistry: equation card -------------------- */

export interface ChemEquationSpec { equation: string; caption?: string }

/** Renders "2H2 + O2 -> 2H2O" (or <-> for equilibrium) with proper
 *  subscripts. Formulas stay plain ASCII from the AI; typography here. */
export function renderChemEquation(spec: ChemEquationSpec): string {
  const parts = String(spec.equation || "").replace(/\s+/g, " ").trim()
    .split(/(->|<->|→|⇌|\+)/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Empty equation.");
  let x = 16;
  const y = 46;
  const pieces: string[] = [];
  for (const part of parts) {
    if (part === "+" || part === "->" || part === "<->" || part === "→" || part === "⇌") {
      const sym = part === "+" ? "+" : (part === "<->" || part === "⇌") ? "⇌" : "→";
      pieces.push(`<text x="${x}" y="${y}" font-size="20" fill="${T.line}">${sym}</text>`);
      x += sym === "+" ? 24 : 34;
      continue;
    }
    // coefficient then formula with digit subscripts (state symbols kept small)
    const m = part.match(/^(\d+)?\s*(.+)$/)!;
    let run = "";
    if (m[1]) run += `<tspan font-weight="700">${m[1]}</tspan>`;
    const formula = m[2];
    for (const tok of formula.match(/\(\w+\)|[A-Z][a-z]?|\d+|./g) || []) {
      if (/^\d+$/.test(tok)) { run += `<tspan font-size="13" dy="5">${tok}</tspan><tspan dy="-5"> </tspan>`; x += tok.length * 8; }
      else if (/^\(\w+\)$/.test(tok)) { run += `<tspan font-size="12" fill="${T.line}">${esc(tok)}</tspan>`; x += tok.length * 7; }
      else { run += `<tspan>${esc(tok)}</tspan>`; x += tok.length * 12; }
    }
    pieces.push(`<text x="${x - (formula.length * 11) - (m[1] ? 12 : 0)}" y="${y}" font-size="20" fill="${T.text}">${run}</text>`);
    x += (m[1] ? 14 : 0) + 14;
  }
  const W = Math.max(260, x + 8);
  return frame(W, 76, `<rect x="4" y="10" width="${W - 8}" height="56" rx="8" fill="${T.fill}" stroke="${T.border}" stroke-width="1"/>` + pieces.join(""), spec.caption);
}

/* --------------------- Biology: Punnett square --------------------- */

export interface PunnettSpec { parent1: [string, string]; parent2: [string, string]; caption?: string }

export function renderPunnett(spec: PunnettSpec): string {
  const [a1, a2] = spec.parent1, [b1, b2] = spec.parent2;
  const cell = 74, x0 = 66, y0 = 56;
  const W = x0 + cell * 2 + 16, H = y0 + cell * 2 + 16;
  const combos = [[b1, a1], [b1, a2], [b2, a1], [b2, a2]];
  const grid = combos.map((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const geno = [c[0], c[1]].sort((p, q) => (p.toLowerCase() === q.toLowerCase() ? (p < q ? -1 : 1) : 0)).join("");
    return `<rect x="${x0 + col * cell}" y="${y0 + row * cell}" width="${cell}" height="${cell}" fill="${T.fill}" stroke="${T.border}" stroke-width="1.2"/>`
      + `<text x="${x0 + col * cell + cell / 2}" y="${y0 + row * cell + cell / 2}" text-anchor="middle" dominant-baseline="middle" font-size="20" fill="${T.text}">${esc(geno)}</text>`;
  }).join("");
  const heads =
    [a1, a2].map((g, i) => `<text x="${x0 + i * cell + cell / 2}" y="${y0 - 14}" text-anchor="middle" font-size="16" fill="${T.border}">${esc(g)}</text>`).join("")
    + [b1, b2].map((g, i) => `<text x="${x0 - 20}" y="${y0 + i * cell + cell / 2}" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="${T.border}">${esc(g)}</text>`).join("")
    + `<text x="${x0 + cell}" y="20" text-anchor="middle" font-size="12" fill="${T.line}">Parent 1 gametes</text>`
    + `<text x="16" y="${y0 + cell}" font-size="12" fill="${T.line}" transform="rotate(-90 16 ${y0 + cell})" text-anchor="middle">Parent 2</text>`;
  return frame(W, H, grid + heads, spec.caption);
}

/* ----------------------- Geography: India map ----------------------- */

export interface IndiaMapSpec { highlight?: string[]; labels?: boolean; caption?: string }
export interface IndiaMapData { viewBox: string; locations: { id: string; name: string; path: string }[] }

/** Data comes from @svg-maps/india (state outline paths only); passed in
 *  by the component so this module stays dependency-free and testable. */
export function renderIndiaMap(data: IndiaMapData, spec: IndiaMapSpec = {}): string {
  const wanted = new Set((spec.highlight || []).map(h => h.trim().toLowerCase()));
  const matches = (loc: { id: string; name: string }) =>
    wanted.has(loc.id.toLowerCase()) || wanted.has(loc.name.toLowerCase());
  const paths = data.locations.map(loc => {
    const hit = matches(loc);
    return `<path d="${loc.path}" fill="${hit ? T.border : T.fill}" stroke="${T.labelBg}" stroke-width="1" opacity="${hit ? 1 : 0.9}"><title>${esc(loc.name)}</title></path>`;
  }).join("");
  const legend = wanted.size
    ? `<text x="10" y="20" font-size="13" fill="${T.text}">Highlighted: ${esc((spec.highlight || []).join(", "))}</text>`
    : "";
  const [, , wRaw, hRaw] = data.viewBox.split(/\s+/).map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wRaw} ${hRaw + (spec.caption ? 28 : 0)}" width="360" role="img" font-family="${FONT}">${paths}${legend}`
    + (spec.caption ? `<text x="${wRaw / 2}" y="${hRaw + 18}" text-anchor="middle" font-size="16" fill="${T.line}">${esc(spec.caption)}</text>` : "")
    + `</svg>`;
}

/* ---------------------- History: timeline ---------------------- */

export interface TimelineSpec { events: { year: string | number; label: string }[]; title?: string; caption?: string }

export function renderTimeline(spec: TimelineSpec): string {
  const events = (spec.events || []).slice(0, 10);
  if (!events.length) throw new Error("Timeline needs events.");
  const W = Math.max(420, events.length * 96), H = 190, midY = H / 2 + 8;
  const step = (W - 80) / Math.max(1, events.length - 1);
  const marks = events.map((e, i) => {
    const x = 40 + i * step;
    const above = i % 2 === 0;
    const ly = above ? midY - 46 : midY + 46;
    const label = String(e.label).length > 26 ? String(e.label).slice(0, 25) + "…" : String(e.label);
    return `<line x1="${x}" y1="${midY}" x2="${x}" y2="${above ? ly + 14 : ly - 22}" stroke="${T.line}" stroke-width="1"/>`
      + `<circle cx="${x}" cy="${midY}" r="6" fill="${T.border}" stroke="${T.labelBg}" stroke-width="1.5"/>`
      + `<text x="${x}" y="${above ? ly + 30 : ly - 30}" text-anchor="middle" font-size="13" font-weight="700" fill="${T.border}">${esc(e.year)}</text>`
      + `<text x="${x}" y="${ly}" text-anchor="middle" font-size="12" fill="${T.text}">${esc(label)}</text>`;
  }).join("");
  const body = defs()
    + (spec.title ? `<text x="${W / 2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="${T.text}">${esc(spec.title)}</text>` : "")
    + `<line x1="16" y1="${midY}" x2="${W - 16}" y2="${midY}" stroke="${T.text}" stroke-width="2" marker-end="url(#sv-arr)"/>`
    + marks;
  return frame(W, H, body, spec.caption);
}

/* ------------------------ CS: logic circuit ------------------------ */

export type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR";
export interface LogicSpec { inputs: string[]; gates: { id: string; gate: GateType; inputs: string[] }[]; output?: string; caption?: string }

function gateShape(x: number, y: number, w: number, h: number, g: GateType): string {
  const bubble = /^(NAND|NOR|NOT|XNOR)$/.test(g)
    ? `<circle cx="${x + w + 5}" cy="${y + h / 2}" r="5" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>` : "";
  const xorExtra = /^X/.test(g)
    ? `<path d="M ${x - 7} ${y} Q ${x + 8} ${y + h / 2} ${x - 7} ${y + h}" fill="none" stroke="${T.border}" stroke-width="1.5"/>` : "";
  if (g === "NOT") {
    return `<polygon points="${x},${y} ${x + w},${y + h / 2} ${x},${y + h}" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>` + bubble;
  }
  if (g === "AND" || g === "NAND") {
    return `<path d="M ${x} ${y} L ${x + w / 2} ${y} A ${h / 2} ${h / 2} 0 0 1 ${x + w / 2} ${y + h} L ${x} ${y + h} Z" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>` + bubble;
  }
  // OR family
  return xorExtra
    + `<path d="M ${x} ${y} Q ${x + w * 0.7} ${y} ${x + w} ${y + h / 2} Q ${x + w * 0.7} ${y + h} ${x} ${y + h} Q ${x + 12} ${y + h / 2} ${x} ${y} Z" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>` + bubble;
}

export function renderLogicCircuit(spec: LogicSpec): string {
  const gates = (spec.gates || []).slice(0, 12);
  if (!gates.length) throw new Error("Logic circuit needs gates.");
  const rank = new Map<string, number>();
  spec.inputs.forEach(i => rank.set(i, 0));
  let changed = true, guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const g of gates) {
      const r = 1 + Math.max(0, ...g.inputs.map(i => rank.get(i) ?? 0));
      if (rank.get(g.id) !== r) { rank.set(g.id, r); changed = true; }
    }
  }
  const maxRank = Math.max(...gates.map(g => rank.get(g.id) || 1));
  const GW = 58, GH = 44, COL = 120, ROWG = 68;
  const pos = new Map<string, { x: number; y: number }>();
  spec.inputs.slice(0, 8).forEach((name, i) => pos.set(name, { x: 26, y: 40 + i * ROWG }));
  for (let r = 1; r <= maxRank; r++) {
    gates.filter(g => rank.get(g.id) === r).forEach((g, i) => pos.set(g.id, { x: 60 + r * COL, y: 34 + i * (ROWG + 14) }));
  }
  const W = 60 + (maxRank + 1) * COL + 40;
  const H = Math.max(160, 40 + Math.max(spec.inputs.length, gates.length) * ROWG);
  const wires = gates.flatMap(g => g.inputs.map((src, i) => {
    const a = pos.get(src), b = pos.get(g.id);
    if (!a || !b) return "";
    const n = g.gate === "NOT" ? 1 : Math.max(2, g.inputs.length);
    const inY = b.y + ((i + 1) / (n + 1)) * GH;
    const ax = a.x + (rank.get(src) === 0 ? 18 : GW + 10);
    const midX = (ax + b.x) / 2;
    return `<path d="M ${ax} ${a.y + (rank.get(src) === 0 ? 0 : GH / 2)} L ${midX} ${a.y + (rank.get(src) === 0 ? 0 : GH / 2)} L ${midX} ${inY} L ${b.x - 2} ${inY}" fill="none" stroke="${T.line}" stroke-width="1.5"/>`;
  })).join("");
  const inputSvg = spec.inputs.slice(0, 8).map(name => {
    const p = pos.get(name)!;
    return `<text x="${p.x - 6}" y="${p.y}" text-anchor="end" dominant-baseline="middle" font-size="14" font-weight="600" fill="${T.text}">${esc(name)}</text>`
      + `<circle cx="${p.x + 14}" cy="${p.y}" r="3" fill="${T.text}"/>`;
  }).join("");
  const gateSvg = gates.map(g => {
    const p = pos.get(g.id)!;
    return gateShape(p.x, p.y, GW, GH, g.gate)
      + `<text x="${p.x + GW * 0.42}" y="${p.y + GH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="10.5" fill="${T.text}">${g.gate}</text>`
      + `<text x="${p.x + GW / 2}" y="${p.y - 6}" text-anchor="middle" font-size="10" fill="${T.line}">${esc(g.id)}</text>`;
  }).join("");
  const out = spec.output && pos.get(spec.output);
  const outSvg = out
    ? `<line x1="${out.x + GW + 10}" y1="${out.y + GH / 2}" x2="${out.x + GW + 42}" y2="${out.y + GH / 2}" stroke="${T.line}" stroke-width="1.5" marker-end="url(#sv-arr)"/><text x="${out.x + GW + 48}" y="${out.y + GH / 2}" dominant-baseline="middle" font-size="14" font-weight="600" fill="${T.border}">Y</text>`
    : "";
  return frame(W, H, defs() + wires + inputSvg + gateSvg + outSvg, spec.caption);
}

/* ---------------------- CS: data structures ---------------------- */

export interface DataStructureSpec { kind: "array" | "stack" | "queue" | "linked-list" | "binary-tree"; values: (string | number)[]; caption?: string }

export function renderDataStructure(spec: DataStructureSpec): string {
  const vals = (spec.values || []).slice(0, 15).map(v => String(v));
  if (!vals.length) throw new Error("Data structure needs values.");
  const CW = 58, CH = 42;

  if (spec.kind === "stack") {
    const W = 220, H = vals.length * CH + 56;
    const cells = vals.map((v, i) => {
      const y = 34 + (vals.length - 1 - i) * CH;
      return `<rect x="70" y="${y}" width="${CW + 20}" height="${CH}" fill="${T.fill}" stroke="${T.border}" stroke-width="1.2"/>`
        + `<text x="${70 + (CW + 20) / 2}" y="${y + CH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="15" fill="${T.text}">${esc(v)}</text>`;
    }).join("");
    const top = `<text x="60" y="${34 + CH / 2}" text-anchor="end" dominant-baseline="middle" font-size="12" fill="${T.border}">TOP →</text>`;
    return frame(W, H, cells + top + `<text x="110" y="${H - 4}" text-anchor="middle" font-size="12" fill="${T.line}">Stack (LIFO)</text>`, spec.caption);
  }

  if (spec.kind === "binary-tree") {
    const depth = Math.ceil(Math.log2(vals.length + 1));
    const W = Math.max(340, 2 ** (depth - 1) * 84), H = depth * 78 + 20;
    const nodes: string[] = [], edges: string[] = [];
    vals.forEach((v, i) => {
      const level = Math.floor(Math.log2(i + 1));
      const idxInLevel = i + 1 - 2 ** level;
      const slots = 2 ** level;
      const x = ((idxInLevel + 0.5) / slots) * W;
      const y = 40 + level * 78;
      if (i > 0) {
        const p = Math.floor((i - 1) / 2);
        const pl = Math.floor(Math.log2(p + 1));
        const px = ((p + 1 - 2 ** pl + 0.5) / 2 ** pl) * W;
        edges.push(`<line x1="${px}" y1="${40 + pl * 78 + 20}" x2="${x}" y2="${y - 20}" stroke="${T.line}" stroke-width="1.5"/>`);
      }
      nodes.push(`<circle cx="${x}" cy="${y}" r="20" fill="${T.fill}" stroke="${T.border}" stroke-width="1.5"/>`
        + `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="${T.text}">${esc(v)}</text>`);
    });
    return frame(W, H, edges.join("") + nodes.join(""), spec.caption);
  }

  // array / queue / linked-list: horizontal cells
  const gap = spec.kind === "linked-list" ? 34 : 0;
  const W = 20 + vals.length * (CW + gap) + 60, H = 120;
  const y = 40;
  const cells = vals.map((v, i) => {
    const x = 20 + i * (CW + gap);
    let cell = `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="${T.fill}" stroke="${T.border}" stroke-width="1.2"/>`
      + `<text x="${x + CW / 2}" y="${y + CH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="15" fill="${T.text}">${esc(v)}</text>`;
    if (spec.kind === "array") cell += `<text x="${x + CW / 2}" y="${y + CH + 16}" text-anchor="middle" font-size="11" fill="${T.line}">[${i}]</text>`;
    if (spec.kind === "linked-list" && i < vals.length - 1) {
      cell += `<line x1="${x + CW}" y1="${y + CH / 2}" x2="${x + CW + gap - 4}" y2="${y + CH / 2}" stroke="${T.line}" stroke-width="1.5" marker-end="url(#sv-arr)"/>`;
    }
    return cell;
  }).join("");
  const ends = spec.kind === "queue"
    ? `<text x="20" y="${y - 10}" font-size="12" fill="${T.border}">FRONT</text><text x="${20 + (vals.length - 1) * CW}" y="${y - 10}" font-size="12" fill="${T.border}">REAR</text>`
    : spec.kind === "linked-list"
    ? `<text x="${20 + vals.length * (CW + gap) + 4}" y="${y + CH / 2}" dominant-baseline="middle" font-size="13" fill="${T.line}">null</text>`
    : "";
  return frame(W, H, defs() + cells + ends, spec.caption);
}
