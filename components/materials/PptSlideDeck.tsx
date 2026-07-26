"use client";

import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { materialVisual } from "@/lib/infer-material-visual";
import { Presentation, Sparkles } from "lucide-react";

const themes = [
  { bg: "from-indigo-950 via-indigo-900 to-violet-800", accent: "bg-amber-300", text: "text-amber-200" },
  { bg: "from-emerald-950 via-teal-900 to-cyan-800", accent: "bg-cyan-300", text: "text-cyan-200" },
  { bg: "from-rose-950 via-fuchsia-900 to-purple-800", accent: "bg-pink-300", text: "text-pink-200" },
  { bg: "from-slate-950 via-blue-950 to-blue-800", accent: "bg-orange-300", text: "text-orange-200" },
];

function DecorativeVisual({ index, content }: { index: number; content: string }) {
  const numbers = content.match(/\d+(?:\.\d+)?/g)?.slice(0, 4) || [];
  if (numbers.length >= 2) return <div className="flex h-44 items-end justify-center gap-4 rounded-2xl bg-white/10 p-5">{numbers.map((number, i) => <div key={`${number}-${i}`} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-lg bg-gradient-to-t from-amber-400 to-pink-400 shadow-lg" style={{ height: `${45 + ((Number(number) || i * 13) % 90)}px` }} /><span className="text-xs font-bold text-white">{number}</span></div>)}</div>;
  return <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-white/10"><div className="absolute h-32 w-32 rotate-12 rounded-3xl border-4 border-cyan-300/80"/><div className="absolute h-24 w-24 -translate-x-12 translate-y-7 rounded-full bg-pink-400/70 blur-[1px]"/><div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-black text-indigo-900 shadow-2xl">{index + 1}</div></div>;
}

export function PptSlideDeck({ material }: { material: any }) {
  const sections = Array.isArray(material?.sections) ? material.sections : [];
  // @container instead of a plain div: this same component renders
  // both inside RAG Classroom's narrow AI Notes panel (roughly a third
  // of the screen, sometimes much narrower once resized — see
  // FloatingPanel) AND full-width on the Material Studio page. Plain
  // Tailwind breakpoints (md:, lg:, ...) respond to the BROWSER
  // window's width regardless of how narrow this component's actual
  // box is — which is exactly why a two-column slide layout sized for
  // a full-width view was clipping/overlapping when squeezed into a
  // panel a third that size. @container breakpoints below respond to
  // THIS element's own rendered width instead, so the same component
  // correctly stacks single-column in a narrow panel and goes two-
  // column when it actually has the room, in either location.
  return <div className="@container space-y-6">
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 p-4 text-white shadow-xl"><Presentation/><div><p className="text-xs font-bold uppercase tracking-[.22em] text-white/70">Presentation deck</p><h2 className="text-xl font-bold">{material?.title || "Study presentation"}</h2></div></div>
    {sections.map((section: any, index: number) => { const theme = themes[index % themes.length]; const visual=materialVisual(section.visual,section.heading,section.content,index); return <article key={index} className={`relative @md:aspect-[16/9] min-h-[360px] overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bg} p-8 text-white shadow-2xl ring-1 ring-white/20`}>
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10"/><div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-black/15"/>
      <div className="relative z-10 flex h-full flex-col"><div className="flex items-center justify-between"><span className={`h-2 w-20 rounded-full ${theme.accent}`}/><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{String(index + 1).padStart(2,"0")} / {String(sections.length).padStart(2,"0")}</span></div>
      <h3 className="mt-5 max-w-4xl text-2xl font-black leading-tight @md:text-3xl @lg:text-4xl">{section.heading || `Slide ${index + 1}`}</h3>
      <div className="mt-6 grid min-h-0 flex-1 gap-7 @lg:grid-cols-[1.25fr_.75fr]"><div><p className="line-clamp-6 whitespace-pre-line text-base leading-7 text-white/90 @md:text-lg @md:leading-8">{section.content}</p>{section.activity&&<div className="mt-5 rounded-xl border border-white/20 bg-white/10 p-3"><p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${theme.text}`}><Sparkles size={14}/> Student activity</p><p className="mt-1 text-sm text-white/90">{section.activity}</p></div>}</div><div className="rounded-2xl bg-white p-3 text-slate-900 shadow-xl"><DiagramRenderer visual={visual}/><p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Interactive concept visual</p></div></div>
      <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-[11px] text-white/60"><span>AI Guru · Visual Learning</span><span>{section.sourceIds?.join(" · ") || section.source || "Textbook grounded"}</span></div></div>
    </article>})}
  </div>;
}
