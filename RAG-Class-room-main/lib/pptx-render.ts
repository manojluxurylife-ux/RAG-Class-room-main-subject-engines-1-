/**
 * Builds a real .pptx file from a SlideDeck (lib/slide-schema.ts) using
 * pptxgenjs — server-side, deterministic, no image generation involved.
 * Diagrams are drawn as native PowerPoint shapes (rectangles, tables,
 * ovals) computed from real geometry — the same "AI supplies data, code
 * draws it correctly" rule as the rest of the visual layer, just
 * targeting .pptx shapes instead of Canvas/SVG.
 *
 * WHY NATIVE SHAPES HERE INSTEAD OF MERMAID, DELIBERATELY:
 * The live classroom lesson (components/visuals/FlowchartVisual.tsx)
 * uses real Mermaid — that's unchanged and correct, because a browser
 * has a real DOM. This file runs server-side with no browser, and that
 * matters: Mermaid was actually tested here with a jsdom polyfill and it
 * fails — it needs real text-layout primitives (SVGElement.getBBox(),
 * which measures actual rendered glyph dimensions) that no DOM polyfill
 * can fake, only a genuine rendering engine can. The only way to get
 * real Mermaid server-side is a full headless browser (Puppeteer +
 * Chromium, ~100-150MB, multi-second cold starts) — a real deployment
 * risk on serverless platforms (e.g. Vercel Hobby's 50MB function
 * limit), and this app's deployment target isn't settled. So: native
 * shapes stay the default, verified working (see the OOXML/XML
 * validation done when this was built), zero deployment risk anywhere.
 * If this app ends up on a persistent VPS specifically, real Mermaid
 * rendering via Puppeteer becomes a reasonable one-time addition —
 * worth revisiting then, not defaulting to now.
 */
import PptxGenJS from "pptxgenjs";
import { THEME_PALETTES, type SlideDeck, type Slide, type SlideDiagram } from "./slide-schema";

const FONT = "Lexend"; // falls back gracefully in PowerPoint if not installed on the viewer's machine

export async function buildPptxBuffer(deck: SlideDeck): Promise<Buffer> {
  const palette = THEME_PALETTES[deck.theme];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10" x 5.625" widescreen, per the design brief

  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    s.background = { color: palette.bg };

    // Thin accent bar at the top — consistent branding without a heavy background image
    s.addShape("rect", { x: 0, y: 0, w: "100%", h: 0.18, fill: { color: palette.primary } });

    switch (slide.kind) {
      case "title":    renderTitleSlide(s, slide, palette); break;
      case "summary":  renderContentSlide(s, slide, palette, "Summary"); break;
      case "quiz":     renderQuizSlide(s, slide, palette); break;
      default:         renderContentSlide(s, slide, palette); break;
    }

    if (slide.speakerNote) s.addNotes(slide.speakerNote);
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

// ── Slide builders ──────────────────────────────────────────────────────────

function renderTitleSlide(s: any, slide: Slide, palette: typeof THEME_PALETTES["blue-orange"]) {
  s.addShape("rect", { x: 0, y: 0, w: "100%", h: "100%", fill: { color: palette.bgAccent }, line: { type: "none" } });
  s.addShape("rect", { x: 0, y: 0.18, w: "100%", h: "100%", fill: { color: palette.bgAccent }, line: { type: "none" } });

  if (slide.emoji) {
    s.addText(slide.emoji, { x: 0, y: 1.1, w: "100%", h: 1.2, align: "center", fontSize: 54 });
  }
  s.addText(slide.heading, {
    x: 0.5, y: 2.4, w: 9, h: 1.6, align: "center", valign: "middle",
    fontFace: FONT, fontSize: 40, bold: true, color: palette.text,
  });
  if (slide.bullets?.[0]) {
    s.addText(slide.bullets[0], {
      x: 0.5, y: 4.0, w: 9, h: 0.6, align: "center",
      fontFace: FONT, fontSize: 18, color: palette.primary,
    });
  }
}

function renderContentSlide(
  s: any, slide: Slide, palette: typeof THEME_PALETTES["blue-orange"], forcedHeading?: string,
) {
  // Heading
  s.addText(`${slide.emoji ? slide.emoji + "  " : ""}${forcedHeading || slide.heading}`, {
    x: 0.5, y: 0.45, w: 9, h: 0.8,
    fontFace: FONT, fontSize: 28, bold: true, color: palette.primary,
  });

  let cursorY = 1.5;

  // Bullets (left column if a diagram is present, full width otherwise)
  const hasDiagram = !!slide.diagram;
  const bulletW = hasDiagram ? 4.2 : 9;

  if (slide.bullets && slide.bullets.length > 0) {
    s.addText(
      slide.bullets.slice(0, 6).map(b => ({ text: b, options: { bullet: { code: "25CF" }, color: palette.text } })),
      { x: 0.5, y: cursorY, w: bulletW, h: 2.6, fontFace: FONT, fontSize: 16, valign: "top", lineSpacingMultiple: 1.3 },
    );
  }

  // Diagram (right column if bullets present, full width otherwise)
  if (slide.diagram) {
    const dx = hasDiagram && slide.bullets?.length ? 5.0 : 0.5;
    const dw = hasDiagram && slide.bullets?.length ? 4.5 : 9;
    renderDiagram(s, slide.diagram, palette, dx, cursorY, dw, 2.6);
  }

  cursorY = hasDiagram || (slide.bullets?.length ?? 0) > 0 ? 4.3 : cursorY;

  // Callout boxes along the bottom
  if (slide.callouts && slide.callouts.length > 0) {
    const boxW = 9 / slide.callouts.length - 0.15;
    slide.callouts.slice(0, 3).forEach((c, i) => {
      const x = 0.5 + i * (boxW + 0.2);
      s.addShape("roundRect", {
        x, y: cursorY, w: boxW, h: 1.1, rectRadius: 0.08,
        fill: { color: palette.bgAccent }, line: { color: palette.secondary, width: 1.5 },
      });
      s.addText(c.label.toUpperCase(), {
        x: x + 0.1, y: cursorY + 0.08, w: boxW - 0.2, h: 0.3,
        fontFace: FONT, fontSize: 10, bold: true, color: palette.secondary,
      });
      s.addText(c.text, {
        x: x + 0.1, y: cursorY + 0.36, w: boxW - 0.2, h: 0.65,
        fontFace: FONT, fontSize: 12, color: palette.text, valign: "top",
      });
    });
  }
}

function renderQuizSlide(s: any, slide: Slide, palette: typeof THEME_PALETTES["blue-orange"]) {
  s.addText(`❓  ${slide.heading}`, {
    x: 0.5, y: 0.6, w: 9, h: 0.8, fontFace: FONT, fontSize: 26, bold: true, color: palette.primary,
  });
  s.addShape("roundRect", {
    x: 0.5, y: 1.7, w: 9, h: 1.6, rectRadius: 0.1,
    fill: { color: palette.bgAccent }, line: { color: palette.primary, width: 1.5 },
  });
  s.addText(slide.quizQuestion || "", {
    x: 0.8, y: 1.9, w: 8.4, h: 1.2, fontFace: FONT, fontSize: 18, color: palette.text, valign: "middle",
  });
  if (slide.quizAnswer) {
    s.addText(`Answer: ${slide.quizAnswer}`, {
      x: 0.8, y: 3.6, w: 8.4, h: 0.6, fontFace: FONT, fontSize: 14, italic: true, color: palette.secondary,
    });
  }
}

// ── Native diagram shapes (no images — pure vector, per the design brief) ───

function renderDiagram(
  s: any, diagram: SlideDiagram, palette: typeof THEME_PALETTES["blue-orange"],
  x: number, y: number, w: number, h: number,
) {
  switch (diagram.type) {
    case "flow":       return renderFlow(s, diagram.items, palette, x, y, w, h);
    case "cycle":       return renderCycle(s, diagram.items, palette, x, y, w, h);
    case "pyramid":     return renderPyramid(s, diagram.items, palette, x, y, w, h);
    case "timeline":    return renderTimeline(s, diagram.items, palette, x, y, w, h);
    case "comparison":  return renderComparison(s, diagram, palette, x, y, w, h);
  }
}

function renderFlow(s: any, items: string[], palette: any, x: number, y: number, w: number, h: number) {
  const n = Math.min(items.length, 5);
  if (n === 0) return;
  const gap = 0.15;
  const boxW = (w - gap * (n - 1)) / n;
  items.slice(0, n).forEach((label, i) => {
    const bx = x + i * (boxW + gap);
    s.addShape("roundRect", {
      x: bx, y: y + h / 2 - 0.4, w: boxW, h: 0.8, rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? palette.primary : palette.secondary }, line: { type: "none" },
    });
    s.addText(label, {
      x: bx + 0.05, y: y + h / 2 - 0.4, w: boxW - 0.1, h: 0.8,
      align: "center", valign: "middle", fontFace: FONT, fontSize: 10, color: "FFFFFF", bold: true,
    });
    if (i < n - 1) {
      s.addShape("rightArrow", {
        x: bx + boxW, y: y + h / 2 - 0.12, w: gap, h: 0.24, fill: { color: palette.text }, line: { type: "none" },
      });
    }
  });
}

function renderCycle(s: any, items: string[], palette: any, x: number, y: number, w: number, h: number) {
  const n = Math.min(items.length, 6);
  if (n === 0) return;
  const cx = x + w / 2, cy = y + h / 2;
  const radius = Math.min(w, h) / 2 - 0.5;
  const boxSize = 0.9;
  items.slice(0, n).forEach((label, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const bx = cx + radius * Math.cos(angle) - boxSize / 2;
    const by = cy + radius * Math.sin(angle) - boxSize / 2;
    s.addShape("oval", {
      x: bx, y: by, w: boxSize, h: boxSize,
      fill: { color: i % 2 === 0 ? palette.primary : palette.secondary }, line: { type: "none" },
    });
    s.addText(label, {
      x: bx - 0.1, y: by, w: boxSize + 0.2, h: boxSize,
      align: "center", valign: "middle", fontFace: FONT, fontSize: 9, color: "FFFFFF", bold: true,
    });
  });
}

function renderPyramid(s: any, items: string[], palette: any, x: number, y: number, w: number, h: number) {
  const n = Math.min(items.length, 5);
  if (n === 0) return;
  const levelH = h / n;
  // items[0] = base (widest), items[n-1] = top (narrowest) — bottom-to-top per the schema
  items.slice(0, n).forEach((label, i) => {
    const levelFromTop = n - 1 - i;
    const widthFrac = 0.3 + (0.7 * (i + 1)) / n; // narrower toward the top
    const boxW = w * widthFrac;
    const bx = x + (w - boxW) / 2;
    const by = y + levelFromTop * levelH;
    s.addShape("rect", {
      x: bx, y: by + 0.02, w: boxW, h: levelH - 0.04,
      fill: { color: interpolateColor(palette.primary, palette.secondary, i / Math.max(1, n - 1)) },
      line: { color: palette.bg, width: 1 },
    });
    s.addText(label, {
      x: bx, y: by + 0.02, w: boxW, h: levelH - 0.04,
      align: "center", valign: "middle", fontFace: FONT, fontSize: 10, color: "FFFFFF", bold: true,
    });
  });
}

function renderTimeline(s: any, items: string[], palette: any, x: number, y: number, w: number, h: number) {
  const n = Math.min(items.length, 6);
  if (n === 0) return;
  const lineY = y + h / 2;
  s.addShape("line", { x, y: lineY, w, h: 0, line: { color: palette.primary, width: 2.5 } });
  const gap = w / n;
  items.slice(0, n).forEach((label, i) => {
    const px = x + gap * i + gap / 2;
    const above = i % 2 === 0;
    s.addShape("oval", {
      x: px - 0.08, y: lineY - 0.08, w: 0.16, h: 0.16,
      fill: { color: palette.secondary }, line: { color: palette.bg, width: 1 },
    });
    s.addText(label, {
      x: px - gap / 2 + 0.05, y: above ? lineY - 0.9 : lineY + 0.15,
      w: gap - 0.1, h: 0.7, align: "center", valign: above ? "bottom" : "top",
      fontFace: FONT, fontSize: 9, color: palette.text,
    });
  });
}

function renderComparison(s: any, diagram: SlideDiagram, palette: any, x: number, y: number, w: number, h: number) {
  const columns = diagram.columns?.slice(0, 4) || [];
  const rows = diagram.rows?.slice(0, 5) || [];
  if (columns.length === 0) return;

  const tableRows = [
    columns.map(c => ({
      text: c,
      options: { fill: { color: palette.primary }, color: "FFFFFF", bold: true, fontFace: FONT, fontSize: 11 },
    })),
    ...rows.map(row => row.map(cell => ({
      text: cell,
      options: { fill: { color: palette.bg }, color: palette.text, fontFace: FONT, fontSize: 10 },
    }))),
  ];

  s.addTable(tableRows, { x, y, w, h, colW: Array(columns.length).fill(w / columns.length), border: { color: palette.bgAccent, pt: 1 } });
}

function interpolateColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA, 16), b = parseInt(hexB, 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return [r, g, bl].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
