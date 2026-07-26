/**
 * Structured slide deck schema — the AI never generates a .pptx file
 * directly (it can't; that's a binary format). Instead it fills this
 * small, checkable JSON structure, and lib/pptx-render.ts builds the
 * actual PowerPoint deterministically from it — same "AI supplies data,
 * real code renders it" pattern as lib/visual-schema.ts, just applied
 * to slide decks instead of individual diagrams.
 *
 * Diagram types are deliberately limited to shapes pptxgenjs can render
 * natively (boxes, arrows, tables) — no image generation, no external
 * dependency, genuinely lightweight output as requested.
 */

export type ThemePreset = "blue-orange" | "purple-pink" | "green-yellow" | "teal-white";

export const THEME_PALETTES: Record<ThemePreset, {
  primary: string; secondary: string; text: string; bg: string; bgAccent: string;
}> = {
  "blue-orange":  { primary: "2563EB", secondary: "F97316", text: "1E293B", bg: "F8FAFC", bgAccent: "DBEAFE" },
  "purple-pink":  { primary: "7C3AED", secondary: "EC4899", text: "1E1B2E", bg: "FAF5FF", bgAccent: "F3E8FF" },
  "green-yellow": { primary: "16A34A", secondary: "EAB308", text: "14532D", bg: "F7FEE7", bgAccent: "DCFCE7" },
  "teal-white":   { primary: "0D9488", secondary: "64748B", text: "134E4A", bg: "FFFFFF", bgAccent: "CCFBF1" },
};

export type SlideDiagramType = "flow" | "cycle" | "pyramid" | "comparison" | "timeline";

export interface SlideDiagram {
  type:     SlideDiagramType;
  items:    string[];      // flow/cycle/pyramid: ordered steps (bottom-to-top for pyramid); timeline: "label: event" strings
  columns?: string[];      // comparison table: column headers
  rows?:    string[][];    // comparison table: row cells, one array per row
}

export interface CalloutBox {
  label: string;   // e.g. "Definition", "Formula", "Remember!", "Common mistake"
  text:  string;
}

export interface Slide {
  kind:         "title" | "content" | "summary" | "quiz";
  heading:      string;
  emoji?:       string;    // single emoji, used sparingly per the design brief
  bullets?:     string[];  // max 6, ~6-8 words each
  callouts?:    CalloutBox[];
  diagram?:     SlideDiagram;
  quizQuestion?:string;    // kind === "quiz"
  quizAnswer?:  string;    // kind === "quiz"
  speakerNote?: string;
}

export interface SlideDeck {
  title:  string;
  theme:  ThemePreset;
  slides: Slide[];
}

/** Loose runtime check — malformed AI output degrades to a clear error
 *  message in the Creator Studio UI, never a crash mid-render. */
export function isValidSlideDeck(v: any): v is SlideDeck {
  if (!v || typeof v.title !== "string" || !Array.isArray(v.slides)) return false;
  if (!(v.theme in THEME_PALETTES)) return false;
  return v.slides.every((s: any) =>
    s && typeof s.kind === "string" && typeof s.heading === "string",
  );
}
