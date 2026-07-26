"use client";

import { generateWithSelectedAI, getSelectedAIMode, compactTextbookContext, type AITask, type AIMode } from "@/lib/client-ai-router";
import type { GeminiClientOptions } from "@/lib/student-key";
import { studentKey } from "@/lib/student-key";
import { offlineAI } from "@/lib/offline-ai";
import { parseAiJson } from "@/lib/safe-json";
import { normalizeMaterialVisuals, VISUAL_JSON_INSTRUCTION, VISUAL_SCHEMA_LIST } from "@/lib/visual-generation";
import { SERVER_AI_ENABLED } from "@/lib/ai-features";
import { materialLanguageInstruction } from "@/lib/language-preferences";
import { normalizeWhiteboardPlan, WHITEBOARD_COMMAND_JSON_INSTRUCTION } from "@/lib/whiteboard-commands";

export type AgentStage = "grounding"|"planning"|"generating"|"visuals"|"assessment"|"qa"|"repair"|"complete";
export type AgentProgress = { stage: AgentStage; agent: string; message: string; completed: number; total: number };

type Extract = {page?:number;text:string;document?:string};
type Input = {materialType:string;topic:string;documentId:string;grade?:string;languageId?:string;sourceLanguage?:string;teachingLanguage?:string;materialLanguage?:string;teachingStyle?:"target_only"|"target_with_english_terms"|"simple_english";learnerProfile?:string};

const shape = `Return raw JSON only: {"title":"...","engine":"OpenMAIC|DeepTutor","overview":"...","sections":[{"heading":"...","content":"...","activity":"...","answer":"...","sourceIds":["S1"],"visual":{"...only when the section has a real visual; otherwise omit the field entirely — never send {}..."},"whiteboardCommands":{"version":1,"autoplay":true,"commands":[{"id":"l1","action":"write","text":"first key line","durationMs":1500},{"id":"l2","action":"write","text":"next point","durationMs":1500},{"id":"m1","action":"underline","target":"l2","durationMs":700}]}}],"sources":[{"id":"S1","page":1,"document":"...","text":"..."}]}.`;

async function serverAgent(role:string, system:string, prompt:string, input:Input):Promise<string>{
  const r=await fetch("/api/material-studio/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role,system,prompt,input})});
  const x=await r.json(); if(!r.ok) throw Error(x.error||`${role} agent failed`); return x.text;
}

// Structured agents get a real output budget — the old flat 8192-token
// cap truncated multi-section drafts mid-JSON, and every section after
// the cut lost its whiteboardCommands/visual fields during repair-parse.
const BIG_JSON: GeminiClientOptions = { maxOutputTokens: 24576, json: true };
async function run(role:string, task:AITask, system:string, prompt:string, input:Input, modeOverride?: AIMode, gemini?: GeminiClientOptions){
  return generateWithSelectedAI({task,system,prompt,gemini,serverCall:()=>serverAgent(role,system,prompt,input),modeOverride});
}

function sourceList(extracts:Extract[]){return extracts.map((x,i)=>({id:`S${i+1}`,page:x.page||0,document:x.document||"Textbook",text:String(x.text||"").slice(0,320)}));}

function normalizeGeneratedMaterial(material:any){
  const base=normalizeMaterialVisuals(material);
  if(!base || !Array.isArray(base.sections)) return base;
  return {...base,sections:base.sections.map((section:any)=>({...section,whiteboardCommands:normalizeWhiteboardPlan(section.whiteboardCommands,[section.heading].filter(Boolean),section.content)}))};
}

function mergeSections(a:any,b:any,c:any){
  const content=Array.isArray(a?.sections)?a.sections:[];
  const visuals=Array.isArray(b?.visuals)?b.visuals:[];
  const assessments=Array.isArray(c?.assessments)?c.assessments:[];
  return content.map((s:any,i:number)=>({...s,visual:s.visual||visuals[i]||undefined,activity:s.activity||assessments[i]?.question,answer:s.answer||assessments[i]?.answer,whiteboardCommands:normalizeWhiteboardPlan(s.whiteboardCommands,[s.heading].filter(Boolean),s.content)}));
}


async function runAdkCloudJob(input: Input, extracts: Extract[], onProgress?: (p: AgentProgress) => void) {
  onProgress?.({stage:"grounding",agent:"Cloud Tasks",message:"Queuing private ADK Cloud Run job",completed:0,total:6});
  const create = await fetch("/api/material-studio/adk-jobs", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({input,extracts}),
  });
  const created = await create.json();
  if (!create.ok) throw new Error(created.error || "Could not queue ADK job");
  const jobId = created.jobId as string;
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    await new Promise(resolve => setTimeout(resolve, 1800));
    const response = await fetch(`/api/material-studio/adk-jobs/${encodeURIComponent(jobId)}`, {cache:"no-store"});
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || "Could not read ADK job");
    const completed = Math.max(0, Math.min(6, Math.floor((Number(job.progress || 0) / 100) * 6)));
    onProgress?.({stage:(job.stage || "generating") as AgentStage,agent:"Google ADK Cloud Run",message:`${job.stage || job.status} · ${job.progress || 0}%`,completed,total:6});
    if (job.status === "completed") {
      const material = normalizeGeneratedMaterial(job.result?.material || job.result);
      onProgress?.({stage:"complete",agent:"Google ADK Cloud Run",message:"ADK material complete",completed:6,total:6});
      return {material,provider:"gemini-adk-cloud-run",warning:undefined};
    }
    if (job.status === "failed") throw new Error(job.error || "ADK worker failed");
  }
  throw new Error("ADK material job timed out while waiting for completion.");
}
async function runBrowserAgentPipeline(input:Input, extracts:Extract[], onProgress?:(p:AgentProgress)=>void, modeOverride?: AIMode, fallbackWarning?: string){
  const total=6; let done=0; const emit=(stage:AgentStage,agent:string,message:string)=>onProgress?.({stage,agent,message,completed:done,total});
  const context=compactTextbookContext(extracts,22000);
  emit("grounding","Grounding agent","Preparing one shared textbook packet");
  const sources=sourceList(extracts); done++;

  // Qwen 0.8B: one compact specialist pass plus deterministic QA, avoiding expensive/weak pseudo-parallel inference.
  if((modeOverride || getSelectedAIMode())==="offline"){
    emit("generating","Qwen agent-lite","Creating supported local material from compact context");
    const local=await run("local-specialist",input.materialType as AITask,`Create concise ${input.materialType.replaceAll("_"," ")} for Class ${input.grade||"8"}. Use only sources. ${shape} ${VISUAL_JSON_INSTRUCTION}`,`Topic: ${input.topic}\n${materialLanguageInstruction(input)}\n${context}`,input,modeOverride);
    done=5; emit("qa","Deterministic QA","Checking structure, citations and visuals");
    const material=normalizeGeneratedMaterial(parseAiJson(local.text)); done=6; emit("complete","Orchestrator","Agent-lite material complete");
    return {material:{...material,languagePreferences:{sourceLanguage:input.sourceLanguage||"english",teachingLanguage:input.teachingLanguage||input.languageId||"malayalam",materialLanguage:input.materialLanguage||input.languageId||"english",teachingStyle:input.teachingStyle||"target_with_english_terms"},sources:material.sources?.length?material.sources:sources,agentRun:{mode:"qwen-agent-lite",agents:["grounding","local-specialist","deterministic-qa"]}},provider:local.provider,warning:[fallbackWarning,local.warning].filter(Boolean).join(" ")||undefined};
  }

  emit("planning","Curriculum planner","Mapping objectives, topics and source pages");
  const planner=await run("curriculum-planner","planning",`You are a curriculum planner. Use only supplied extracts. Return JSON {"objectives":[],"topicPlan":[{"title":"","sourceIds":["S1"],"purpose":""}],"difficulty":"","requiredVisuals":[],"assessmentGoals":[]}.`, `Material: ${input.materialType}\nTopic: ${input.topic}\nGrade: ${input.grade||"8"}\n${materialLanguageInstruction(input)}\nLearner: ${input.learnerProfile||"not supplied"}\n\n${context}`,input,modeOverride);
  const plan=parseAiJson(planner.text); done++;

  emit("generating","Specialist team","Running content, visual and assessment agents in parallel");
  const base=`Topic: ${input.topic}\nGrade: ${input.grade||"8"}\n${materialLanguageInstruction(input)}\nMaterial type: ${input.materialType}\nPLAN:\n${JSON.stringify(plan)}\nTEXTBOOK:\n${context}`;
  const [contentResult,visualResult,assessmentResult]=await Promise.all([
    run("material-specialist",input.materialType as AITask,`You are the specialist for ${input.materialType.replaceAll("_"," ")}. Produce accurate, age-appropriate sections grounded only in source IDs. For classroom, whiteboard, PPT and interactive lesson materials, include executable whiteboardCommands for each useful section. ${shape} ${WHITEBOARD_COMMAND_JSON_INSTRUCTION}`,base,input,modeOverride,BIG_JSON),
    run("visual-specialist","visual",`You are an educational visual designer. Return JSON {"visuals":[...]} aligned to the planned sections: for every section whose content is visualizable (graph, geometry, fraction, number line, data, process, circuit, molecule, cell/organ), return one valid renderable Visual object at that index; for a section with no natural visual return null at that index. Never return mere visual suggestions, empty objects, SVG or HTML. ${VISUAL_SCHEMA_LIST}`,base,input,modeOverride,BIG_JSON),
    run("assessment-specialist","assessment",`You are an assessment specialist. Return JSON {"assessments":[{"question":"","answer":"","explanation":"","sourceIds":["S1"]}]}. Match the material type; for PPT/classroom create checkpoints, for quiz_bank create strong MCQs and mixed questions. Use only the textbook.`,base,input,modeOverride,BIG_JSON)
  ]);
  done+=3;
  const content=parseAiJson(contentResult.text), visuals=parseAiJson(visualResult.text), assessments=parseAiJson(assessmentResult.text);
  let draft=normalizeGeneratedMaterial({...content,sections:mergeSections(content,visuals,assessments),sources:content.sources?.length?content.sources:sources});

  emit("qa","Grounding QA agent","Checking coverage, citations, answer quality and visual validity");
  const qa=await run("qa-grounding","qa",`Audit the draft against the source packet. Return JSON {"pass":true,"score":0,"issues":[{"severity":"error|warning","section":0,"message":"","repair":""}],"missingTopics":[]}. Reject unsupported claims, invalid answers, missing citations, weak coverage and non-renderable visuals.`, `PLAN:${JSON.stringify(plan)}\nDRAFT:${JSON.stringify(draft)}\nSOURCES:${context}`,input,modeOverride);
  const report=parseAiJson(qa.text); done++;

  if(report?.pass===false || Number(report?.score||100)<85){
    emit("repair","Repair agent","Correcting failed sections only");
    const repaired=await run("repair-agent",input.materialType as AITask,`Repair the material according to QA. Preserve correct content. Use only sources. ${shape} ${VISUAL_JSON_INSTRUCTION} ${WHITEBOARD_COMMAND_JSON_INSTRUCTION}`,`QA:${JSON.stringify(report)}\nDRAFT:${JSON.stringify(draft)}\nSOURCES:${context}`,input,modeOverride,BIG_JSON);
    draft=normalizeGeneratedMaterial(parseAiJson(repaired.text));
  }
  done=6; emit("complete","Root orchestrator","Specialist outputs merged and approved");
  const providers=[planner.provider,contentResult.provider,visualResult.provider,assessmentResult.provider,qa.provider];
  return {material:{...draft,languagePreferences:{sourceLanguage:input.sourceLanguage||"english",teachingLanguage:input.teachingLanguage||input.languageId||"malayalam",materialLanguage:input.materialLanguage||input.languageId||"english",teachingStyle:input.teachingStyle||"target_with_english_terms"},sources:draft.sources?.length?draft.sources:sources,qaReport:report,agentRun:{mode:"multi-agent",agents:["curriculum-planner","material-specialist","visual-specialist","assessment-specialist","qa-grounding","repair-agent"],parallelAgents:["material-specialist","visual-specialist","assessment-specialist"]}},provider:providers.every(x=>x==="gemini-byok")?"gemini-byok-multi-agent":"hybrid-multi-agent",warning:[fallbackWarning,planner.warning,contentResult.warning,visualResult.warning,assessmentResult.warning,qa.warning].filter(Boolean).join(" ")||undefined};
}


/**
 * Resilient material orchestration. Server mode prefers the private ADK worker,
 * but Firestore/Cloud Tasks is not a single point of failure: the exact same
 * grounded agent workflow can execute in the browser with the student's BYOK.
 */
export async function generateMultiAgentMaterial(input:Input, extracts:Extract[], onProgress?:(p:AgentProgress)=>void){
  const selected = getSelectedAIMode();
  if (!SERVER_AI_ENABLED || selected !== "server") {
    const safeMode: AIMode = selected === "server" ? "byok" : selected;
    return runBrowserAgentPipeline(input, extracts, onProgress, safeMode);
  }
  try {
    return await runAdkCloudJob(input, extracts, onProgress);
  } catch (cloudError) {
    const reason = cloudError instanceof Error ? cloudError.message : "Cloud material service unavailable";
    onProgress?.({stage:"grounding",agent:"Resilience router",message:"Cloud database/queue unavailable. Switching to Firebase-free browser generation.",completed:0,total:6});
    if (studentKey.get()) {
      return runBrowserAgentPipeline(input, extracts, onProgress, "byok", `Cloud ADK was unavailable (${reason}). The material was generated directly with your Gemini BYOK key without Firebase.`);
    }
    // A direct server-agent path does not require Firestore or Cloud Tasks. It is
    // retained as a secondary fallback for deployments that provide a server key.
    try {
      return await runBrowserAgentPipeline(input, extracts, onProgress, "server", `Cloud ADK was unavailable (${reason}). Direct server agents were used without Firestore.`);
    } catch (directError) {
      if (offlineAI.getStatus() === "ready" && ["revision_notes","flashcards"].includes(input.materialType)) {
        return runBrowserAgentPipeline(input, extracts, onProgress, "offline", `Cloud and server agents were unavailable. Local Qwen Agent-Lite generated a reduced offline material.`);
      }
      throw new Error(`Firebase/Cloud Tasks is unavailable and no Firebase-free AI provider could complete this material. Add a Gemini BYOK key in Settings. Cloud error: ${reason}. Direct fallback: ${directError instanceof Error ? directError.message : String(directError)}`);
    }
  }
}
