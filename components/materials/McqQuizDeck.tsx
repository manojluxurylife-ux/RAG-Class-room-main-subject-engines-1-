"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, RotateCcw, Trophy } from "lucide-react";
import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { materialVisual } from "@/lib/infer-material-visual";
import { FlashcardDeck } from "@/components/materials/FlashcardDeck";

const palettes = ["from-violet-600 to-indigo-700", "from-cyan-600 to-blue-700", "from-rose-600 to-fuchsia-700", "from-emerald-600 to-teal-700", "from-orange-500 to-rose-600"];

export function McqQuizDeck({ material }: { material: any }) {
  const questions = Array.isArray(material?.sections) ? material.sections : [];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  if (material?.materialType === "flashcards") return <FlashcardDeck material={material}/>;
  const completed = Object.keys(answers).length;
  // See PptSlideDeck.tsx for why @container/@md/@lg instead of plain
  // Tailwind breakpoints — same component, same narrow-panel-vs-full-
  // page problem (this is what was overlapping/clipping when squeezed
  // into RAG Classroom's AI Notes panel).
  return <section className="@container space-y-5 rounded-3xl bg-gradient-to-b from-indigo-950/60 to-board2 p-5 ring-1 ring-violet-400/30">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 p-5 text-white shadow-xl"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/75">Chapter challenge</p><h2 className="mt-1 text-2xl font-black">{material?.title || "MCQ Quiz"}</h2><p className="mt-1 text-sm text-white/80">Choose an answer, then reveal the explanation.</p></div><div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3"><Trophy className="text-yellow-300"/><div><b>{completed}/{questions.length}</b><p className="text-[10px] uppercase text-white/70">attempted</p></div></div></header>
    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 transition-all" style={{width:`${questions.length?completed/questions.length*100:0}%`}}/></div>
    <div className="grid gap-5 @2xl:grid-cols-2">{questions.map((question:any,index:number)=>{const options=Array.isArray(question.options)&&question.options.length?question.options:[question.optionA,question.optionB,question.optionC,question.optionD].filter(Boolean);const correct=String(question.correctAnswer||question.answer||"");const selected=answers[index];const show=revealed[index];const visual=materialVisual(question.visual,question.heading,String(question.question||question.content||""),index);return <article key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-board shadow-xl"><div className={`bg-gradient-to-r ${palettes[index%palettes.length]} p-4 text-white`}><div className="flex items-center justify-between"><span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Question {index+1}</span><HelpCircle size={18}/></div><h3 className="mt-3 text-lg font-bold leading-7">{question.question||question.heading}</h3></div><div className="grid gap-4 p-4 @md:grid-cols-[.72fr_1.28fr]"><div className="rounded-xl bg-white p-2 text-slate-900 shadow-inner"><DiagramRenderer visual={visual}/><p className="text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">Question visual</p></div><div className="space-y-2">{options.length?options.map((option:any,optionIndex:number)=>{const value=String(option);const isSelected=selected===value;const isCorrect=show&&(correct===value||correct.startsWith(String.fromCharCode(65+optionIndex)));return <button key={optionIndex} onClick={()=>setAnswers(current=>({...current,[index]:value}))} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${isCorrect?"border-emerald-400 bg-emerald-500/20 text-emerald-100":isSelected?"border-amber bg-amber/15 text-chalk":"border-board3 bg-board2 text-chalkdim hover:border-violet-400 hover:text-chalk"}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold">{String.fromCharCode(65+optionIndex)}</span>{value}{isCorrect&&<CheckCircle2 className="ml-auto" size={17}/>}</button>}):<p className="rounded-xl bg-board2 p-3 text-sm leading-6 text-chalk">{question.content}</p>}<button onClick={()=>setRevealed(current=>({...current,[index]:!current[index]}))} className="mt-2 flex items-center gap-2 text-xs font-bold text-amber">{show?<RotateCcw size={14}/>:<CheckCircle2 size={14}/>} {show?"Hide answer":"Reveal answer"}</button>{show&&<div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100"><b>Answer:</b> {correct||"See textbook explanation"}{question.explanation&&<p className="mt-1 text-emerald-100/80">{question.explanation}</p>}</div>}</div></div></article>})}</div>
  </section>;
}
