export interface TextMetricsProvider { measure(text: string, fontSize: number, fontFamily: string): number }
export interface WhiteboardTextLayout { lines: string[]; width: number; height: number; fontSize: number; lineHeight: number }

const family = "Kalam, cursive";

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), x => x.segment);
  }
  return Array.from(text);
}

function splitLongToken(token: string, maxWidth: number, fontSize: number, metrics: TextMetricsProvider): string[] {
  const result: string[] = [];
  let current = "";
  for (const ch of graphemes(token)) {
    const candidate = current + ch;
    if (current && metrics.measure(candidate, fontSize, family) > maxWidth) {
      result.push(current); current = ch;
    } else current = candidate;
  }
  if (current) result.push(current);
  return result;
}

export function layoutWhiteboardText(text: string, maxWidth: number, requestedFontSize: number, metrics: TextMetricsProvider, maxHeight = Infinity): WhiteboardTextLayout {
  let fontSize = Math.max(12, Math.min(96, requestedFontSize));
  while (fontSize >= 12) {
    const lines: string[] = [];
    for (const paragraph of String(text).split(/\r?\n/)) {
      const tokens = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) { lines.push(""); continue; }
      let line = "";
      for (const token of tokens) {
        const pieces = metrics.measure(token, fontSize, family) > maxWidth ? splitLongToken(token, maxWidth, fontSize, metrics) : [token];
        for (const piece of pieces) {
          const candidate = line ? `${line} ${piece}` : piece;
          if (line && metrics.measure(candidate, fontSize, family) > maxWidth) { lines.push(line); line = piece; }
          else line = candidate;
        }
      }
      if (line) lines.push(line);
    }
    const lineHeight = fontSize * 1.28;
    const height = Math.max(lineHeight, lines.length * lineHeight);
    if (height <= maxHeight || fontSize === 12) {
      return { lines, width: Math.min(maxWidth, Math.max(1, ...lines.map(l => metrics.measure(l, fontSize, family)))), height, fontSize, lineHeight };
    }
    fontSize -= 1;
  }
  return { lines: [text], width: maxWidth, height: 16, fontSize: 12, lineHeight: 15.36 };
}
