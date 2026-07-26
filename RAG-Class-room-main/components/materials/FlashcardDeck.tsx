"use client";

import { useState } from "react";
import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { materialVisual } from "@/lib/infer-material-visual";
import { Brain, RotateCw, Sparkles } from "lucide-react";

const themes = ["from-violet-600 to-indigo-800", "from-rose-500 to-pink-700", "from-cyan-500 to-blue-700", "from-emerald-500 to-teal-700", "from-orange-500 to-red-600"];

export function FlashcardDeck({ material }: { material: any }) {
  const cards = Array.isArray(material?.sections) ? material.sections : [];
  const [flipped, setFlipped] = useState<Record<number,boolean>>({});
  return <section className="space-y-5 rounded-3xl bg-gradient-to-b from-violet-950/60 to-board2 p-5 ring-1 ring-violet-400/30">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-xl"><div className="flex items-center gap-3"><div className="rounded-2xl bg-white/15 p-3"><Brain/></div><div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/70">Visual memory deck</p><h2 className="text-2xl font-black">{material?.title||"Chapter Flashcards"}</h2></div></div><span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">{cards.length} cards</span></header>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cards.map((card:any,index:number)=>{const isFlipped=flipped[index];const front=card.question||card.heading||`Card ${index+1}`;const back=card.answer||card.content||card.explanation||"Review the textbook concept.";const visual=materialVisual(card.visual,front,String(back),index);return <button key={index} type="button" onClick={()=>setFlipped(current=>({...current,[index]:!current[index]}))} className="group min-h-[390px] overflow-hidden rounded-3xl border border-white/10 bg-board text-left shadow-2xl transition hover:-translate-y-1 hover:border-violet-400"><div className={`bg-gradient-to-br ${themes[index%themes.length]} p-5 text-white`}><div className="flex items-center justify-between"><span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Card {index+1}</span><RotateCw className="transition group-hover:rotate-180" size={18}/></div><p className="mt-5 min-h-16 text-xl font-black leading-7">{isFlipped?"Answer & explanation":front}</p></div><div className="p-4"><div className="rounded-2xl bg-white p-2 text-slate-900 shadow-inner"><DiagramRenderer visual={visual}/></div><div className={`mt-4 rounded-xl p-3 ${isFlipped?"bg-emerald-500/15 text-emerald-100":"bg-violet-500/10 text-chalkdim"}`}><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><Sparkles size={13}/>{isFlipped?"Remember":"Tap to reveal"}</p><p className="mt-2 line-clamp-5 text-sm leading-6">{isFlipped?back:"Think of the answer, then flip this card."}</p></div><p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-chalkdim">{card.sourceIds?.join(" · ")||card.source||"Textbook grounded"}</p></div></button>})}</div>
  </section>;
}
