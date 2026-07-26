/**
 * Tiny flowchart renderer — replaces the mermaid dependency.
 *
 * WHY: mermaid was 89 MB of build-time weight (the single biggest cause
 * of out-of-memory production builds on small tiers) and a ~1.4 MB
 * gzipped runtime chunk on budget Android phones — while the app only
 * ever generates the simplest slice of its grammar: `flowchart TD` with
 * labelled boxes and arrows (see fallbackVisual() and the AI prompt in
 * visual-generation.ts). This module implements exactly that slice in
 * plain SVG. The AI-facing contract (the "mermaidSyntax" field and its
 * grammar) is unchanged, so nothing upstream — prompts, schema,
 * validation, stored materials — needed to change.
 *
 * Supported grammar (a strict superset of what the prompts produce):
 *   flowchart TD|TB|LR|RL          (also `graph ...`; TB ≡ TD)
 *   A[Rectangle]  A(Rounded)  A((Circle))  A{Diamond}
 *   A --> B       A --- B     (chains: A --> B --> C)
 *   A -->|label| B              A -- label --> B
 *   multiple statements per line separated by `;`
 *
 * Anything unparseable throws — the component shows the same friendly
 * "Couldn't render this diagram." it always did for bad mermaid.
 */

export type FlowNodeShape = "rect" | "round" | "circle" | "diamond";

export interface FlowNode { id: string; label: string; shape: FlowNodeShape }
export interface FlowEdge { from: string; to: string; label?: string }
export interface FlowGraph { direction: "TD" | "LR"; nodes: FlowNode[]; edges: FlowEdge[] }

const MAX_NODES = 30;
const MAX_EDGES = 60;

const NODE_TOKEN = /^([A-Za-z0-9_.-]+)\s*(\[\[?|\(\(?|\{)?\s*/;

function readNode(src: string, into: Map<string, FlowNode>): { id: string; rest: string } | null {
  const m = src.match(NODE_TOKEN);
  if (!m) return null;
  const id = m[1];
  let rest = src.slice(m[0].length);
  const opener = m[2] || "";
  if (!opener) {
    if (!into.has(id)) into.set(id, { id, label: id, shape: "rect" });
    return { id, rest: src.slice(m[1].length) };
  }
  const closer = opener.startsWith("[") ? "]".repeat(opener.length)
    : opener.startsWith("(") ? ")".repeat(opener.length)
    : "}";
  const end = rest.indexOf(closer);
  if (end === -1) return null;
  let label = rest.slice(0, end).trim().replace(/^"([^"]*)"$/, "$1");
  rest = rest.slice(end + closer.length);
  const shape: FlowNodeShape = opener === "((" ? "circle" : opener === "(" ? "round" : opener === "{" ? "diamond" : "rect";
  // Last declaration wins for the label (mermaid behaviour).
  into.set(id, { id, label: label || id, shape });
  return { id, rest };
}

export function parseMermaidFlowchart(syntax: string): FlowGraph {
  const text = String(syntax || "").replace(/\r/g, "").trim();
  const lines = text.split(/\n|;/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Empty flowchart.");

  let direction: "TD" | "LR" = "TD";
  const header = lines[0].match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL)?/i);
  let body = lines;
  if (header) {
    const d = (header[1] || "TD").toUpperCase();
    direction = d === "LR" || d === "RL" ? "LR" : "TD";
    body = lines.slice(1);
  }

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  for (const raw of body) {
    // Skip mermaid extras we deliberately don't support visually.
    if (/^(classDef|class|style|linkStyle|subgraph|end|click|%%)/i.test(raw)) continue;

    let rest = raw;
    const first = readNode(rest, nodes);
    if (!first) throw new Error(`Cannot parse: "${raw}"`);
    let fromId = first.id;
    rest = first.rest.trim();

    // Chain: --> [|label| or -- label -->] node, repeated.
    while (rest.length) {
      let label: string | undefined;
      let m = rest.match(/^--\s*([^->][^-]*?)\s*-->\s*/);       // A -- label --> B
      if (m) { label = m[1].trim(); rest = rest.slice(m[0].length); }
      else {
        m = rest.match(/^(-->|---)\s*/);                         // A --> B / A --- B
        if (!m) throw new Error(`Cannot parse edge in: "${raw}"`);
        rest = rest.slice(m[0].length);
        const lm = rest.match(/^\|([^|]*)\|\s*/);                // -->|label|
        if (lm) { label = lm[1].trim(); rest = rest.slice(lm[0].length); }
      }
      const next = readNode(rest, nodes);
      if (!next) throw new Error(`Missing edge target in: "${raw}"`);
      edges.push({ from: fromId, to: next.id, ...(label ? { label } : {}) });
      fromId = next.id;
      rest = next.rest.trim();
    }
  }

  if (!nodes.size) throw new Error("No nodes found.");
  if (nodes.size > MAX_NODES || edges.length > MAX_EDGES) throw new Error("Flowchart too large.");
  return { direction, nodes: [...nodes.values()], edges };
}

/* ------------------------------ layout ------------------------------ */

interface Sized extends FlowNode { w: number; h: number; lines: string[] }
interface Placed extends Sized { x: number; y: number; rank: number }

const FONT = 13, CHAR_W = 7.4, LINE_H = 18, PAD_X = 14, PAD_Y = 10;
const RANK_GAP = 46, NODE_GAP = 26;

function wrapLabel(label: string, maxChars = 20): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function sizeNode(n: FlowNode): Sized {
  const lines = wrapLabel(n.label);
  const textW = Math.max(...lines.map(l => l.length)) * CHAR_W;
  const textH = lines.length * LINE_H;
  let w = textW + PAD_X * 2, h = textH + PAD_Y * 2;
  if (n.shape === "diamond") { w += 34; h += 22; }
  if (n.shape === "circle") { const d = Math.max(w, h) + 8; w = d; h = d; }
  return { ...n, w: Math.max(64, w), h: Math.max(36, h), lines };
}

/** Longest-path ranking from source nodes; cycles broken by visit order. */
function rankNodes(graph: FlowGraph): Map<string, number> {
  const rank = new Map<string, number>();
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  graph.nodes.forEach(n => { out.set(n.id, []); indeg.set(n.id, 0); });
  graph.edges.forEach(e => {
    if (!out.has(e.from) || !out.has(e.to)) return;
    out.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
  });
  const queue = graph.nodes.filter(n => (indeg.get(n.id) || 0) === 0).map(n => n.id);
  if (!queue.length && graph.nodes.length) queue.push(graph.nodes[0].id); // pure cycle
  queue.forEach(id => rank.set(id, 0));
  const seen = new Set(queue);
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of out.get(id) || []) {
      const proposed = (rank.get(id) || 0) + 1;
      if (!rank.has(next) || proposed > (rank.get(next) || 0)) {
        if (!seen.has(next) || (rank.get(next) || 0) < proposed) rank.set(next, Math.min(proposed, MAX_NODES));
      }
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  graph.nodes.forEach(n => { if (!rank.has(n.id)) rank.set(n.id, 0); });
  return rank;
}

export function layoutFlowchart(graph: FlowGraph): { nodes: Placed[]; width: number; height: number } {
  const vertical = graph.direction === "TD";
  const sized = graph.nodes.map(sizeNode);
  const ranks = rankNodes(graph);

  const byRank = new Map<number, Sized[]>();
  sized.forEach(n => {
    const r = ranks.get(n.id) || 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  });

  // Order within a rank by average position of parents (fewer crossings).
  const placed: Placed[] = [];
  const posOf = new Map<string, number>();
  const rankKeys = [...byRank.keys()].sort((a, b) => a - b);
  let main = 0; // along the flow axis
  let maxCross = 0;
  for (const r of rankKeys) {
    const row = byRank.get(r)!;
    row.sort((a, b) => {
      const avg = (n: Sized) => {
        const parents = graph.edges.filter(e => e.to === n.id).map(e => posOf.get(e.from));
        const known = parents.filter((v): v is number => v !== undefined);
        return known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0;
      };
      return avg(a) - avg(b);
    });
    const rowMainSize = Math.max(...row.map(n => vertical ? n.h : n.w));
    const totalCross = row.reduce((s, n) => s + (vertical ? n.w : n.h), 0) + NODE_GAP * (row.length - 1);
    maxCross = Math.max(maxCross, totalCross);
    let cross = 0;
    row.forEach((n, i) => {
      const cx = cross + (vertical ? n.w : n.h) / 2;
      posOf.set(n.id, i);
      placed.push({
        ...n, rank: r,
        x: vertical ? cx : main + rowMainSize / 2,
        y: vertical ? main + rowMainSize / 2 : cx,
      });
      cross += (vertical ? n.w : n.h) + NODE_GAP;
    });
    main += rowMainSize + RANK_GAP;
  }
  // Center each rank on the cross axis.
  for (const r of rankKeys) {
    const row = placed.filter(p => p.rank === r);
    const rowCross = row.reduce((s, n) => s + (vertical ? n.w : n.h), 0) + NODE_GAP * (row.length - 1);
    const shift = (maxCross - rowCross) / 2;
    row.forEach(n => { if (vertical) n.x += shift; else n.y += shift; });
  }
  const width = vertical ? maxCross : main - RANK_GAP;
  const height = vertical ? main - RANK_GAP : maxCross;
  return { nodes: placed, width, height };
}

/* ------------------------------ render ------------------------------ */

export interface FlowchartTheme {
  fill: string; text: string; border: string; line: string; labelBg: string;
}

/** Matches the chalkboard theme previously passed to mermaid.initialize. */
export const CHALKBOARD_THEME: FlowchartTheme = {
  fill: "#284134", text: "#f4f1e8", border: "#e8a33d", line: "#b9c4ba", labelBg: "#1f3328",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function nodeSvg(n: Placed, t: FlowchartTheme): string {
  const { x, y, w, h } = n;
  let shape: string;
  if (n.shape === "circle") shape = `<circle cx="${x}" cy="${y}" r="${w / 2}" fill="${t.fill}" stroke="${t.border}" stroke-width="1.5"/>`;
  else if (n.shape === "diamond") shape = `<polygon points="${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}" fill="${t.fill}" stroke="${t.border}" stroke-width="1.5"/>`;
  else shape = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${n.shape === "round" ? h / 2 : 6}" fill="${t.fill}" stroke="${t.border}" stroke-width="1.5"/>`;
  const startY = y - ((n.lines.length - 1) * LINE_H) / 2;
  const text = n.lines.map((line, i) =>
    `<text x="${x}" y="${startY + i * LINE_H}" text-anchor="middle" dominant-baseline="middle" font-size="${FONT}" fill="${t.text}">${esc(line)}</text>`,
  ).join("");
  return shape + text;
}

/** Point on the node border toward (tx, ty). */
function anchor(n: Placed, tx: number, ty: number): [number, number] {
  const dx = tx - n.x, dy = ty - n.y;
  if (dx === 0 && dy === 0) return [n.x, n.y];
  if (n.shape === "circle") {
    const d = Math.hypot(dx, dy) || 1;
    return [n.x + (dx / d) * (n.w / 2), n.y + (dy / d) * (n.w / 2)];
  }
  const sx = Math.abs(dx) / (n.w / 2), sy = Math.abs(dy) / (n.h / 2);
  const s = Math.max(sx, sy) || 1;
  return [n.x + dx / s, n.y + dy / s];
}

export function renderFlowchartSvg(syntax: string, theme: FlowchartTheme = CHALKBOARD_THEME): string {
  const graph = parseMermaidFlowchart(syntax);
  const { nodes, width, height } = layoutFlowchart(graph);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const M = 12; // outer margin

  const edgeSvg = graph.edges.map(e => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return "";
    const [x1, y1] = anchor(a, b.x, b.y);
    const [x2, y2] = anchor(b, a.x, a.y);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const line = `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${theme.line}" stroke-width="1.5" marker-end="url(#fc-arrow)"/>`;
    if (!e.label) return line;
    const lw = e.label.length * (CHAR_W - 1) + 8;
    return line
      + `<rect x="${mx - lw / 2}" y="${my - 10}" width="${lw}" height="20" rx="4" fill="${theme.labelBg}" stroke="${theme.line}" stroke-width="0.5"/>`
      + `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="${FONT - 2}" fill="${theme.text}">${esc(e.label)}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-M} ${-M} ${width + M * 2} ${height + M * 2}" width="${width + M * 2}" height="${height + M * 2}" role="img" font-family="Work Sans, sans-serif">`
    + `<defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.line}"/></marker></defs>`
    + edgeSvg
    + nodes.map(n => nodeSvg(n, theme)).join("")
    + `</svg>`;
}
