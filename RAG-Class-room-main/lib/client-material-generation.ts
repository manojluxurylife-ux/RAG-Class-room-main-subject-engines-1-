"use client";
import { generateWithSelectedAI, compactTextbookContext, type AITask } from "@/lib/client-ai-router";
import { parseAiJson } from "@/lib/safe-json";
import { normalizeLessonVisuals, normalizeMaterialVisuals, LESSON_VISUAL_INSTRUCTION } from "@/lib/visual-generation";
import { generateMultiAgentMaterial, type AgentProgress } from "@/lib/multi-agent-materials";
import { teachingLanguageInstruction } from "@/lib/language-preferences";
import { normalizeWhiteboardPlan, WHITEBOARD_COMMAND_JSON_INSTRUCTION } from "@/lib/whiteboard-commands";

export async function fetchGrounding(documentId:string, topic:string, k=10, pageStart?:number, pageEnd?:number){
  const cacheKey=`ai-guru-grounding:${documentId}:${topic.trim().toLowerCase()}:${k}:${pageStart||0}:${pageEnd||0}`;
  try {
    const r=await fetch("/api/rag/context",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentId,topic,k,pageStart,pageEnd})});
    const x=await r.json(); if(!r.ok) throw Error(x.error||"Could not retrieve textbook context");
    const extracts=x.extracts||[];
    try { localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),extracts})); } catch {}
    return extracts;
  } catch (error) {
    try {
      const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
      if(Array.isArray(cached?.extracts)&&cached.extracts.length) return cached.extracts;
    } catch {}
    throw error;
  }
}

export async function generateRagLessonClient(input:{topic:string;documentId:string;grade?:string;languageId?:string;sourceLanguage?:string;teachingLanguage?:string;materialLanguage?:string;teachingStyle?:"target_only"|"target_with_english_terms"|"simple_english";pageStart?:number;pageEnd?:number}){
  const extracts=await fetchGrounding(input.documentId,input.topic,input.pageStart?30:8,input.pageStart,input.pageEnd);
  const context=compactTextbookContext(extracts,18000);
  const gradeInstruction=input.grade?`The selected textbook is for Class/Grade ${input.grade}. Use that exact grade and never mention another class.`:"Do not state or guess a class/grade unless it is explicitly present in the extracts.";
  const system=`Create a textbook-grounded classroom lesson. ${gradeInstruction} Use ONLY the supplied extracts: do not add generic introductions, outside facts, invented examples, or unsupported claims. Every factual sentence must be supported by the scene's sourceIds. If the extracts do not support a point, omit it. ${teachingLanguageInstruction({sourceLanguage:input.sourceLanguage,teachingLanguage:input.teachingLanguage||input.languageId,materialLanguage:input.materialLanguage,teachingStyle:input.teachingStyle})} Teach each selected paragraph in this exact sequence: (1) READ scene: narration is the relevant textbook paragraph in its original source language, phase "read", narrationLanguage "${input.sourceLanguage||"english"}", spotlight is a short exact phrase from that paragraph, and board/whiteboardCommands are empty; (2) EXPLAIN scene: explain the same paragraph mainly in the student's teaching language, phase "explain", narrationLanguage "${input.teachingLanguage||input.languageId||"malayalam"}", keep technical terms in English, use the same sourcePage/sourceIds/spotlight, and do not copy the English paragraph again; (3) SOLVE scene whenever the paragraph has a formula, worked example, or problem: phase "solve", narrationLanguage "${input.teachingLanguage||input.languageId||"malayalam"}", narrate the reasoning in the teaching language while keeping formulas and technical terms in English, and solve step by step on the whiteboard. Return raw JSON exactly: {"title":"...","scenes":[{"type":"teacher|explain|discussion|quiz","phase":"read|explain|solve","title":"...","narration":"...","narrationLanguage":"english|malayalam","sourcePage":1,"sourceIds":["S1"],"spotlight":"exact short phrase copied verbatim from the source page","board":["..."],"question":"...","visual":{"...include only when the scene has a real visual, using a validated visual object; otherwise omit this field entirely..."},"whiteboardCommands":{"version":1,"autoplay":true,"commands":[{"id":"l1","action":"write","text":"first key line","durationMs":1500},{"id":"l2","action":"write","text":"next step","durationMs":1500},{"id":"m1","action":"underline","target":"l2","durationMs":700}]}}],"sources":[{"id":"S1","page":1,"text":"..."}]}. Create 2-3 complete paragraph units (normally 6-9 scenes) in textbook page order. Every scene MUST include sourcePage matching the page being taught and sourceIds supporting it. In every READ and EXPLAIN scene the flashlight must stay on the exact paragraph through spotlight. For every SOLVE scene generate step-by-step whiteboardCommands using write plus laser, underline or circle, and arrows between steps; never return prose-only board content for a calculation. Do not move backward unless reviewing. ${LESSON_VISUAL_INSTRUCTION} ${WHITEBOARD_COMMAND_JSON_INSTRUCTION}`;
  const whiteboardFirstSystem = `${system} In this classroom, use the AI whiteboard during most teaching time. Every EXPLAIN scene must write 2-5 concise key lines and animate laser/underline/circle/arrows. Every SOLVE scene must show every calculation step. Whenever the supported textbook content has a graph, geometric figure, number line, fraction, flow, circuit, molecule, cell structure, or other genuinely useful picture, include a valid renderable visual object in that EXPLAIN or SOLVE scene. Prefer a diagram or graph over a long prose board. Never invent a picture that is not supported by the textbook.`;
  const prompt=`Topic: ${input.topic}\n${input.pageStart?`Continue teaching pages ${input.pageStart}-${input.pageEnd}.\n`:""}Teaching language: ${input.teachingLanguage||input.languageId||"english"}\nStudy-material language: ${input.materialLanguage||"english"}\n\nTEXTBOOK EXTRACTS:\n${context}`;
  const result=await generateWithSelectedAI({task:"rag_lesson",system:whiteboardFirstSystem,prompt,gemini:{maxOutputTokens:32768,json:true},serverCall:async()=>{const r=await fetch("/api/rag/lesson",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const x=await r.json();if(!r.ok)throw Error(x.error||"Generation failed");return JSON.stringify(x.lesson)}});
  const base=normalizeLessonVisuals(parseAiJson(result.text));
  const lesson={...base,scenes:Array.isArray(base?.scenes)?base.scenes.map((scene:any,index:number)=>{const sourceId=Array.isArray(scene.sourceIds)?scene.sourceIds[0]:undefined;const sourceIndex=sourceId?Number(String(sourceId).replace(/\D/g,""))-1:index;const source=extracts[Math.max(0,Math.min(extracts.length-1,Number.isFinite(sourceIndex)?sourceIndex:index))];const phase=["read","explain","solve"].includes(scene.phase)?scene.phase:(scene.type==="explain"?"explain":"solve");return {...scene,phase,narrationLanguage:scene.narrationLanguage||(phase==="read"?(input.sourceLanguage||"english"):(input.teachingLanguage||input.languageId||"malayalam")),sourcePage:Math.max(1,Number(scene.sourcePage||source?.page||1)),sourceIds:Array.isArray(scene.sourceIds)?scene.sourceIds:[`S${Math.max(0,sourceIndex)+1}`],whiteboardCommands:normalizeWhiteboardPlan(scene.whiteboardCommands,Array.isArray(scene.board)?scene.board:[],scene.explanationNarration||scene.solveNarration||scene.narration)};}):[]};
  return {lesson:{...lesson,lessonWorkflowVersion:"whiteboard-first-v2",textbookGrade:input.grade||null,documentId:input.documentId,languagePreferences:{sourceLanguage:input.sourceLanguage||"english",teachingLanguage:input.teachingLanguage||input.languageId||"malayalam",materialLanguage:input.materialLanguage||"english",teachingStyle:input.teachingStyle||"target_with_english_terms"}},provider:result.provider,warning:result.warning};
}

export async function generateMaterialClient(input:{materialType:string;topic:string;documentId:string;grade?:string;languageId?:string;sourceLanguage?:string;teachingLanguage?:string;materialLanguage?:string;teachingStyle?:"target_only"|"target_with_english_terms"|"simple_english";learnerProfile?:string;pageStart?:number;pageEnd?:number}, onProgress?:(p:AgentProgress)=>void){
  const extracts=await fetchGrounding(input.documentId,input.topic,input.pageStart?40:10,input.pageStart,input.pageEnd);
  const result=await generateMultiAgentMaterial(input,extracts,onProgress);
  return {material:result.material,provider:result.provider,warning:result.warning};
}
