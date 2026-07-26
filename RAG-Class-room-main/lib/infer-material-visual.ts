import { isValidVisual, type Visual } from "@/lib/visual-schema";

/** Converts text-only AI output into a safe visual-schema object so the
 * deterministic drawing libraries always have something useful to render. */
export function materialVisual(explicit: unknown, heading = "", content = "", index = 0): Visual {
  if (isValidVisual(explicit)) return explicit;
  const text = `${heading} ${content}`.toLowerCase();
  const numbers = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite).slice(0, 5);
  if (/right.?triangle|pythag|hypotenuse/.test(text)) return { type: "geometry", shape: "right-triangle", legs: [3, 4], labels: { a: "3", b: "4", c: "5" } };
  if (/triangle|centroid|orthocentre|median|altitude/.test(text)) return { type: "geometry", shape: "triangle", sides: [5, 5, 6] };
  if (/circle|radius|diameter|circumference/.test(text)) return { type: "geometry", shape: "circle", radius: Math.abs(numbers[0] || 5) };
  if (/rectangle|area|perimeter/.test(text)) return { type: "geometry", shape: "rectangle", width: Math.abs(numbers[0] || 8), height: Math.abs(numbers[1] || 5) };
  if (/fraction|numerator|denominator/.test(text)) return { type: "fraction", numerator: Math.max(1,Math.abs(Math.round(numbers[0]||2))), denominator: Math.max(2,Math.abs(Math.round(numbers[1]||5))), style: "pie" };
  if (/equation|linear|quadratic|function|graph|coordinate/.test(text)) return { type: "graph", expression: /quadratic|x²|x\^2/.test(text) ? "x^2" : "2*x + 1", domain: [-5, 5], label: heading };
  if (/sequence|number line|integer|negative/.test(text)) return { type: "number-line", min: -5, max: 10, points: (numbers.length?numbers:[0,2,5]).slice(0,4).map(value=>({value,label:String(value)})) };
  if (/process|cycle|steps|method|flow/.test(text)) return { type: "flowchart", mermaidSyntax: "A[Understand] --> B[Apply] --> C[Check]" };
  const values = numbers.length >= 2 ? numbers.map(value=>Math.max(1,Math.min(100,Math.abs(value)))) : [45 + index % 20, 70, 88];
  return { type: "bar-chart", labels: values.map((_,i)=>["Concept","Example","Practice","Result","Review"][i]), values, label: heading || "Learning visual" };
}
