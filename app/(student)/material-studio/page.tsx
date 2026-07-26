"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Download, FileText, HardDrive, Layers3, Loader2, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { textbookContext } from "@/lib/textbook-context";
import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { PptSlideDeck } from "@/components/materials/PptSlideDeck";
import { McqQuizDeck } from "@/components/materials/McqQuizDeck";
import { fetchGrounding, generateMaterialClient } from "@/lib/client-material-generation";
import type { AgentProgress } from "@/lib/multi-agent-materials";
import { getSelectedAIMode } from "@/lib/client-ai-router";
import { listOfflineMaterials, saveStudioMaterial } from "@/lib/offline-materials";
import { saveStudioMaterialWithDriveFallback } from "@/lib/client/save-with-drive-fallback";
import { checkDeviceStorage } from "@/lib/storage-check";
import { studentSession } from "@/lib/student-session";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import type { TeachingStyle } from "@/lib/language-preferences";
import { extractPageText } from "@/lib/client/pdf-text";
import { savePdf } from "@/lib/client/pdf-store";
import { callGeminiClient, studentKey, validateGeminiKey } from "@/lib/student-key";
import { parseAiJson } from "@/lib/safe-json";
import { normalizeWhiteboardPlan, WHITEBOARD_COMMAND_JSON_INSTRUCTION } from "@/lib/whiteboard-commands";
import { runWithConcurrency } from "@/lib/client/run-with-concurrency";
import { safeStorage, safeStringify } from "@/lib/safe-storage";
import { subjectVisualGuidance } from "@/lib/visual-generation";

type Doc={id:string;name:string;pages:number;chunks:number;subject?:string;grade?:string;syllabus?:string;sourceLanguage?:string;learningLanguage?:string};
const UPLOAD_SUBJECTS=["Mathematics","Physics","Chemistry","Biology","Science","English","Social Science","Computer Science"];
const UPLOAD_LANGUAGES=[{id:"english",label:"English"},{id:"malayalam",label:"Malayalam"}];
const LEARNING_LANGUAGES=[{id:"english",label:"English"},{id:"hindi",label:"Hindi"},{id:"malayalam",label:"Malayalam"},{id:"tamil",label:"Tamil"}];
const TYPES=[
 ["classroom","Classroom teaching","OpenMAIC"],["ppt","PPT slides","OpenMAIC"],["web_lesson","Interactive web lesson","OpenMAIC"],["simulation","Simulation","OpenMAIC"],["whiteboard","Whiteboard teaching","OpenMAIC"],["discussion","AI classroom discussion","OpenMAIC"],
 ["interactive_book","Interactive book","DeepTutor"],["flashcards","Flashcards","DeepTutor"],["revision_notes","Revision notes","DeepTutor"],["knowledge_base","Knowledge base","DeepTutor"],["research","Research material","DeepTutor"],["personalized","Personalized study","DeepTutor"],["quiz_bank","Quiz bank","DeepTutor"],["memory","Long-term learning memory","DeepTutor"]
];
const BATCH_MATERIALS=[
 ["memory","Notes"],["ppt","PPT"],["flashcards","Flashcards"],["quiz_bank","MCQ"],
 ["personalized","Worksheet"],["knowledge_base","Mind Map"],["interactive_book","Interactive Book"],
 ["research","Revision Notes"],["classroom","Lesson Plan"],["discussion","Teaching Script"],["whiteboard","Whiteboard Commands"],
] as const;
export default function MaterialStudio(){
  const router = useRouter();
 const [docs,setDocs]=useState<Doc[]>([]),[documentId,setDocumentId]=useState(""),[materialType,setMaterialType]=useState("classroom"),[topic,setTopic]=useState(""),[grade,setGrade]=useState("8"),[sourceLanguage,setSourceLanguage]=useState("english"),[teachingLanguage,setTeachingLanguage]=useState("malayalam"),[materialLanguage,setMaterialLanguage]=useState("english"),[teachingStyle,setTeachingStyle]=useState<TeachingStyle>("target_with_english_terms"),[profile,setProfile]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<any>(null),[error,setError]=useState(""),[agentProgress,setAgentProgress]=useState<AgentProgress|null>(null),[offlineSaved,setOfflineSaved]=useState(false);
 const [pdfFile,setPdfFile]=useState<File|null>(null),[uploadingPdf,setUploadingPdf]=useState(false),[uploadStatus,setUploadStatus]=useState("");
 const [selectedPdfName,setSelectedPdfName]=useState(""),[uploadOutcome,setUploadOutcome]=useState<"idle"|"success"|"error">("idle"),[pendingAutoUpload,setPendingAutoUpload]=useState(false);
 const [showUploadErrors,setShowUploadErrors]=useState(false);
 const [uploadSubject,setUploadSubject]=useState(""),[uploadSyllabus,setUploadSyllabus]=useState(""),[uploadLanguage,setUploadLanguage]=useState(""),[learningLanguage,setLearningLanguage]=useState("");
 const [batchRunning,setBatchRunning]=useState(false),[batchStatus,setBatchStatus]=useState<Record<string,{state:"not-created"|"waiting"|"running"|"complete"|"error";message:string}>>({}),[batchSummary,setBatchSummary]=useState("");
 const [addingNew,setAddingNew]=useState(false);
 const [openingMaterial,setOpeningMaterial]=useState("");
 const missingUploadFields=[["subject",uploadSubject],["class",grade],["syllabus",uploadSyllabus],["PDF language",uploadLanguage],["learning language",learningLanguage]].filter(([,value])=>!value).map(([label])=>label);
 async function refreshDocs(preferredId?:string){const r=await fetch("/api/rag/ingest");const x=await r.json();const next=x.documents||[];setDocs(next);setDocumentId(preferredId||next[0]?.id||"");}
 // Resets the upload form and clears the active document so the student
 // can index a different textbook (different subject, class, or
 // language) without any leftover state from the previous one bleeding
 // into it. Does NOT delete the previous textbook or its already-created
 // materials — they're still indexed server-side and still listed once
 // the student picks a document again; this only clears what's showing
 // right now so a fresh upload starts from a genuinely blank form.
 function addAnotherPdf(){
  setAddingNew(true);
  setDocumentId("");
  setPdfFile(null);setSelectedPdfName("");setUploadOutcome("idle");setUploadStatus("");setPendingAutoUpload(false);setShowUploadErrors(false);
  setUploadSubject("");setUploadSyllabus("");setUploadLanguage("");setLearningLanguage("");
  setBatchStatus({});setBatchSummary("");
  setTopic("");
  if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});
 }
  useEffect(()=>{
    document.body.classList.add("material-studio-page");
    return()=>document.body.classList.remove("material-studio-page")
  },[]);
 useEffect(()=>{const p=studentSession.get(); if(p){setGrade(p.grade||"8");setSourceLanguage(p.sourceLanguage||"english");setTeachingLanguage(p.teachingLanguage||p.languageId||"malayalam");setMaterialLanguage(p.materialLanguage||"english");setTeachingStyle(p.teachingStyle||"target_with_english_terms");} refreshDocs()},[]);
 useEffect(()=>{if(!documentId)return;try{const saved=safeStorage.get(`ai-guru-material-batch:${documentId}`);setBatchStatus(saved?.statuses||{});setBatchSummary(saved?.summary||"");}catch{setBatchStatus({});setBatchSummary("");}},[documentId]);
 useEffect(()=>{if(!documentId&&docs[0]?.id&&!addingNew)setDocumentId(docs[0].id)},[docs,documentId,addingNew]);
 useEffect(()=>{const doc=docs.find(item=>item.id===documentId);if(!doc)return;if(doc.grade)setGrade(doc.grade);if(doc.sourceLanguage)setSourceLanguage(doc.sourceLanguage);if(doc.learningLanguage){setTeachingLanguage(doc.learningLanguage);setMaterialLanguage(doc.learningLanguage);}},[documentId,docs]);
 useEffect(()=>{if(pendingAutoUpload&&pdfFile&&uploadSubject&&grade&&uploadSyllabus&&uploadLanguage&&learningLanguage&&!uploadingPdf)uploadPdf(pdfFile);},[pendingAutoUpload,pdfFile,uploadSubject,grade,uploadSyllabus,uploadLanguage,learningLanguage,uploadingPdf]);
 const selected=useMemo(()=>TYPES.find(x=>x[0]===materialType),[materialType]);
 async function openCreatedMaterial(materialId:string){
  if(batchStatus[materialId]?.state!=="complete")return;
  setOpeningMaterial(materialId);setError("");
  try{const saved=await listOfflineMaterials();const record=saved.find(item=>item.kind==="material-studio"&&item.documentId===documentId&&item.materialType===materialId);if(!record)throw new Error("The saved content could not be found. Please create this material again.");setMaterialType(materialId==="flashcards"?"quiz_bank":materialId);setResult({...record.data,materialType:materialId});setOfflineSaved(true);setTimeout(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"smooth"}),50);}catch(e:any){setError(e.message||"Could not open this material.");}finally{setOpeningMaterial("");}
 }

 async function createAllStudyMaterials(retryFailedOnly:unknown=false){
   const retryOnly=retryFailedOnly===true;
  if(batchRunning)return;
  if(pendingAutoUpload||uploadingPdf){setShowUploadErrors(missingUploadFields.length>0);setBatchSummary(missingUploadFields.length?`Complete the required ${missingUploadFields.join(", ")} field${missingUploadFields.length>1?"s":""} and wait for this PDF to finish uploading.`:"Please wait for the selected PDF to finish uploading and indexing.");return;}
  let availableDocs=docs;
  let activeDocumentId=documentId||availableDocs[0]?.id||"";
  if(!activeDocumentId){try{const response=await fetch("/api/rag/ingest",{cache:"no-store"});const payload=await response.json();availableDocs=payload.documents||[];setDocs(availableDocs);activeDocumentId=availableDocs[0]?.id||"";}catch{}}
  if(!activeDocumentId){setBatchSummary("No indexed textbook was found. Upload and index a PDF first.");return;}
  if(!documentId)setDocumentId(activeDocumentId);
  const selectedDoc=availableDocs.find(doc=>doc.id===activeDocumentId)||availableDocs[0];
  const usableKey = studentKey.get();
  if(!usableKey){setBatchSummary("No usable Gemini key is connected. Open Settings and add a valid key.");return;}
  const detectedTopic=topic.trim()||`Complete textbook: ${selectedDoc?.name||"Uploaded textbook"}`;
   const failedIds=new Set(BATCH_MATERIALS.filter(([id])=>batchStatus[id]?.state==="error").map(([id])=>id));
   const materialsToRun=retryOnly?BATCH_MATERIALS.filter(([id])=>failedIds.has(id)):BATCH_MATERIALS;
   if(!materialsToRun.length){setBatchSummary("There are no failed materials to retry.");return;}
   setBatchRunning(true);setBatchSummary(retryOnly?`Retrying ${materialsToRun.length} failed material${materialsToRun.length>1?"s":""} at the same time…`:"Creating all study materials at the same time…");
   setBatchStatus(current=>retryOnly?{...current,...Object.fromEntries(materialsToRun.map(([id])=>[id,{state:"waiting" as const,message:"Waiting to start"}]))}:Object.fromEntries(BATCH_MATERIALS.map(([id])=>[id,{state:"waiting" as const,message:"Waiting to start"}])));
   // Proactive, one-time heads-up (not per-material) — checks the
   // browser's storage estimate before a big batch of materials starts
   // saving. Materials always try the device FIRST regardless of this
   // check (that's what makes offline classroom teaching work); this
   // just warns honestly upfront if the device looks tight, rather than
   // students discovering a silent switch to Drive mid-batch with no
   // explanation. The actual permission step is Google's own sign-in
   // consent screen, triggered once, only if a save genuinely needs it.
   try {
     const storageStatus = await checkDeviceStorage(materialsToRun.length * 2);
     if (storageStatus.supported && storageStatus.isLow) {
       setBatchSummary(`Your device is low on storage space (about ${Math.max(0,Math.round(storageStatus.availableMB))} MB free). Materials that don't fit will be saved to your Google Drive instead — you may be asked to sign in and approve this once.`);
     }
   } catch { /* storage estimate is best-effort; never block creation over it */ }
  const totalPages=Math.max(1,Number(selectedDoc?.pages||1)),pagesPerPart=Math.ceil(totalPages/5);
  const accumulated:Record<string,any>={};const failed=new Map<string,string>();const savedToDrive=new Set<string>();
  // PPT receives its own full response budget. Mixing it with five other agents
  // caused long textbooks to be compressed into only a handful of slides.
   const pptGroup=materialsToRun.filter(([id])=>id==="ppt");
   const mcqGroup=materialsToRun.filter(([id])=>id==="quiz_bank");
   const flashcardGroup=materialsToRun.filter(([id])=>id==="flashcards");
   const otherMaterials=materialsToRun.filter(([id])=>id!=="ppt"&&id!=="quiz_bank"&&id!=="flashcards");
  const groups=[pptGroup,mcqGroup,flashcardGroup,otherMaterials.slice(0,5),otherMaterials.slice(5)].filter(group=>group.length>0);
  // Each group's own 5 textbook parts MUST stay sequential — part 2 reads
  // and appends onto part 1's already-saved result for the SAME material
  // (see `previous=accumulated[materialType]` below), so two parts for
  // one material finishing out of order would race and silently corrupt
  // or drop sections. But the groups themselves (ppt-only, mcq-only,
  // flashcards-only, and the two "other materials" halves) never touch
  // each other's data — nothing stops them running independently. This
  // is what "create all materials at the same time" actually means here:
  // every group's 5-part pipeline runs concurrently with every other
  // group's, while each individual pipeline stays correctly ordered.
  // Google's own error text ("...denied access. Please contact
  // support.") is a dead end for a student — they can't literally
  // contact Google support. This appends a concrete next step instead
  // of showing that raw text alone, for the error shapes that mean
  // "this key won't work right now, but the batch/retry system can
  // route around it" rather than "your input was invalid."
  function friendlyBatchError(raw: string): string {
    const looksLikeKeyIssue = /denied access|quota|exceeded|permission|rate limit|429/i.test(raw);
    return looksLikeKeyIssue
      ? `${raw} This is a Gemini account issue, not something in your textbook — try "Retry failed materials only" below in a bit, or add another key in Settings if you have one.`
      : raw;
  }

  async function runGroup(group:(typeof BATCH_MATERIALS[number])[]){
   for(let part=1;part<=5;part++){
    const activeGroup=group.filter(([id])=>!failed.has(id));if(!activeGroup.length)return;
    const pageStart=(part-1)*pagesPerPart+1,pageEnd=Math.min(totalPages,part*pagesPerPart);
    const extracts=await fetchGrounding(activeDocumentId,"",40,pageStart,pageEnd);
    // Source IDs must remain unique across all five parts. Reusing S1 in
    // every part made later chapters resolve to part 1 / the cover page.
    const partSources=extracts.map((item:any,index:number)=>({...item,id:`P${part}-S${index+1}`}));
    const context=partSources.map((item:any)=>`[${item.id}] Page ${item.page}: ${item.text}`).join("\n\n").slice(0,26000);
    activeGroup.forEach(([id])=>setBatchStatus(current=>({...current,[id]:{state:"running",message:id==="ppt"?`Part ${part}/5 · detecting chapters and building 5 slides each`:id==="quiz_bank"?`Part ${part}/5 · building at least 5 MCQs per chapter`:id==="flashcards"?`Part ${part}/5 · building at least 5 visual cards per chapter`:`Part ${part}/5 · pages ${pageStart}-${pageEnd} · compact agent group`}})));
    const requested=activeGroup.map(([id,label])=>({materialType:id,label}));
    try{
     const pptInstruction=activeGroup.some(([id])=>id==="ppt")?`PPT REQUIREMENT: First detect every chapter represented in these extracts. For EACH detected chapter create EXACTLY 5 section objects, one object per presentation slide: (1) chapter opener and learning goals, (2) core concept with worked explanation, (3) visual/diagram or graph specification, (4) worked example or classroom activity, and (5) recap plus assessment. Prefix every heading with the chapter title. Never summarize multiple chapters into five total slides. Include a valid visual object whenever the topic supports graph, geometry, number-line, flowchart, fraction, bar-chart, circuit, molecule, biology-diagram, solid-3d, or geogebra rendering.`:"";
     const mcqInstruction=activeGroup.some(([id])=>id==="quiz_bank")?`MCQ REQUIREMENT: Detect every chapter represented in these extracts and create AT LEAST 5 section objects for EACH chapter. Each section is one question and must contain: "heading" as the chapter title, "question", "options" as exactly four plausible answer strings, "correctAnswer" as the full correct option, "explanation", and "sourceIds". Mix recall, understanding, application, and worked-problem difficulty. Never create only five questions for the whole textbook.`:"";
     const flashcardInstruction=activeGroup.some(([id])=>id==="flashcards")?`FLASHCARD REQUIREMENT: Detect every chapter represented in these extracts and create AT LEAST 5 section objects for EACH chapter. Each section is one flashcard with "heading" as a concise front-side question, "content" as the accurate back-side answer and memory explanation, "chapter", "sourceIds", and a valid "visual" whenever possible. Cover definitions, concepts, formulas, applications, and common misconceptions. Never create only five cards for the entire textbook.`:"";
      const systemPrompt=`You are a coordinated team of Indian-school study-material specialists. Create every requested material from ONLY the supplied textbook extracts. Return raw JSON only: {"materials":[{"materialType":"...","title":"...","overview":"...","sections":[{"heading":"...","content":"...","activity":"...","answer":"...","sourceIds":["P1-S1"],"visual":null,"whiteboardCommands":{"version":1,"autoplay":true,"commands":[]}}]}]}. This output is prepared ONCE and later taught by a browser without calling AI. For classroom, discussion, whiteboard, notes and worked examples, write complete student-ready narration and executable whiteboard commands. Explanations MUST be written primarily in ${teachingLanguage}${teachingLanguage==="malayalam"?" using Malayalam script":""}; keep only formulas and technical terms in English. Never write an English explanation and merely label it as ${teachingLanguage}. Every section must cite the exact source IDs shown in the extracts (including their P-part prefix) and remain in textbook page order. ${WHITEBOARD_COMMAND_JSON_INSTRUCTION}${subjectVisualGuidance(selectedDoc?.subject)} ${pptInstruction} ${mcqInstruction} ${flashcardInstruction}`;
      const userPrompt=`Class: ${grade}\nTextbook: ${selectedDoc?.name}\nPart ${part} of 5, pages ${pageStart}-${pageEnd}\nRequested materials: ${safeStringify(requested)}\n\nTEXTBOOK EXTRACTS:\n${context}`;
      const raw=await callGeminiClient(systemPrompt,userPrompt);
      const parsed=parseAiJson(raw);const outputs=Array.isArray(parsed?.materials)?parsed.materials:[];
      for(const [materialType,label] of activeGroup){
       let generated=outputs.find((item:any)=>item.materialType===materialType);
       // Combined requests occasionally omit one agent. Retry that one agent
       // immediately with its own response budget instead of failing the pack.
       if(!generated){
        setBatchStatus(current=>({...current,[materialType]:{state:"running",message:`Part ${part}/5 · combined response omitted this item · retrying separately`}}));
        try{const retryRaw=await callGeminiClient(systemPrompt,`Class: ${grade}\nTextbook: ${selectedDoc?.name}\nPart ${part} of 5, pages ${pageStart}-${pageEnd}\nCreate ONLY this requested material: ${safeStringify({materialType,label})}\n\nTEXTBOOK EXTRACTS:\n${context}`);const retryParsed=parseAiJson(retryRaw);generated=(Array.isArray(retryParsed?.materials)?retryParsed.materials:[]).find((item:any)=>item.materialType===materialType)||((retryParsed?.materialType===materialType)?retryParsed:null);}catch{}
       }
       if(!generated){failed.set(materialType,"Gemini did not return this material after an individual retry");setBatchStatus(current=>({...current,[materialType]:{state:"error",message:`Failed at part ${part}/5 · missing output after retry`}}));continue;}
      const previous=accumulated[materialType];
      const newSections=(generated.sections||[]).map((section:any)=>({...section,sourcePart:part,sourcePageStart:pageStart,sourcePageEnd:pageEnd,whiteboardCommands:normalizeWhiteboardPlan(section.whiteboardCommands,[section.heading,section.content,section.activity,section.answer].filter(Boolean))}));
      const material={...generated,title:previous?.title||generated.title,overview:[previous?.overview,generated.overview].filter(Boolean).join("\n\n"),sections:[...(previous?.sections||[]),...newSections],sources:[...(previous?.sources||[]),...partSources],offlineId:`batch-${activeDocumentId}-${materialType}`,processedParts:part,totalParts:5,_provider:"gemini-byok-prepared-once",batchLabel:label,batchSourceDocumentId:activeDocumentId,preparedForBrowserTeaching:true,languagePreferences:{sourceLanguage,teachingLanguage,materialLanguage,teachingStyle}};
      accumulated[materialType]=material;
      const saveOutcome=await saveStudioMaterialWithDriveFallback({
        material,materialType,topic:detectedTopic,documentId:activeDocumentId,
        onFallbackStarting:()=>setBatchStatus(current=>({...current,[materialType]:{state:"running",message:"Device storage is full — asking permission to save to your Google Drive…"}})),
      });
      if(saveOutcome.savedTo==="failed"){failed.set(materialType,saveOutcome.error);setBatchStatus(current=>({...current,[materialType]:{state:"error",message:`Failed at part ${part}/5 · ${friendlyBatchError(saveOutcome.error)}`}}));continue;}
      if(saveOutcome.savedTo==="drive")savedToDrive.add(materialType);
      setBatchStatus(current=>({...current,[materialType]:{state:part===5?"complete":"running",message:part===5?(saveOutcome.savedTo==="drive"?"Created · saved to Google Drive (device storage was full)":"Created · all 5 parts stored"):`Part ${part}/5 stored${saveOutcome.savedTo==="drive"?" to Google Drive":""} · waiting for part ${part+1}`}}));
     }
    }catch(error:any){const message=error.message||`Part ${part} failed`;activeGroup.forEach(([id])=>{failed.set(id,message);setBatchStatus(current=>({...current,[id]:{state:"error",message:`Failed at part ${part}/5 · ${friendlyBatchError(message)}`}}));});return;}
   }
  }
  // Concurrency = the number of groups (at most 5: ppt, mcq, flashcards,
  // and two "other materials" halves) — every group runs at the same
  // time, exactly as requested. runWithConcurrency still caps this
  // safely in case a future change ever produces more groups than that.
  // WAS concurrency: groups.length — which equals the total number of
  // groups, so every group fired at once regardless of this setting,
  // completely defeating the point of runWithConcurrency (see its own
  // comment: a burst of simultaneous BYOK Gemini calls risks tripping
  // the student's key's rate limit). This is very likely why most
  // materials were failing with "denied access" while one or two
  // happened to race ahead and succeed — 5 simultaneous calls against
  // a single free-tier key is exactly the burst that trips a per-
  // minute limit. Capped at 2 in-flight groups at a time instead —
  // still meaningfully faster than fully sequential, without firing
  // the whole batch as one burst.
  await runWithConcurrency({tasks:groups.map(group=>()=>runGroup(group)),concurrency:Math.min(2,groups.length||1)});
   const previouslyComplete=retryOnly?BATCH_MATERIALS.filter(([id])=>batchStatus[id]?.state==="complete").length:0;
   const completed=previouslyComplete+materialsToRun.filter(([id])=>!failed.has(id)&&accumulated[id]?.processedParts===5).length;
  const driveNote=savedToDrive.size?` ${savedToDrive.size} material${savedToDrive.size>1?"s were":" was"} saved to your Google Drive instead of this device (storage was full) — ${savedToDrive.size>1?"these need":"this needs"} an internet connection to open, unlike materials saved on the device.`:"";
  const summary=`${completed} of ${BATCH_MATERIALS.length} study materials are validated, stored, and ready.${completed===BATCH_MATERIALS.length?" RAG Classroom is ready to teach.":" Failed agents can be retried by running the pipeline again."}${driveNote}`;
   setBatchStatus(current=>{const finalStatuses={...current};materialsToRun.forEach(([id])=>{if(!failed.has(id)&&accumulated[id]?.processedParts===5)finalStatuses[id]={state:"complete",message:"Created · all 5 parts validated and stored"};});try{safeStorage.set(`ai-guru-material-batch:${activeDocumentId}`,{statuses:finalStatuses,summary,savedAt:Date.now()});}catch{}return finalStatuses;});
  textbookContext.set({documentId:activeDocumentId,documentName:selectedDoc?.name||"Uploaded textbook",topic:detectedTopic});
  setBatchSummary(summary);setBatchRunning(false);
 }
 async function generate(){setBusy(true);setError("");setResult(null);setOfflineSaved(false);setAgentProgress(null);try{const x=await generateMaterialClient({materialType,topic,documentId,grade,languageId:materialLanguage,sourceLanguage,teachingLanguage,materialLanguage,teachingStyle,learnerProfile:profile},setAgentProgress);const completed={...x.material,_provider:x.provider,_warning:x.warning};setResult(completed);
  // Save the completed Gemini/Qwen output as structured data in IndexedDB.
  // Offline replay never calls Gemini, Firestore, or the RAG APIs again.
  try { await saveStudioMaterial({material:completed,materialType,topic,documentId}); setOfflineSaved(true); } catch { /* generation still succeeded; browser may block IndexedDB */ }
  // Same handoff as RAG Classroom: let the live voice doubt dock know
  // which textbook/topic this material came from (lib/textbook-context.ts).
  const docName=docs.find(d=>d.id===documentId)?.name||"Indexed textbook";
  textbookContext.set({documentId,documentName:docName,topic});
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 function download(ext:"json"|"md"){if(!result)return;let text=safeStringify(result);if(ext==="md"){text=`# ${result.title}\n\n${result.overview||""}\n\n`+(result.sections||[]).map((s:any,i:number)=>`## ${i+1}. ${s.heading}\n\n${s.content||""}\n\n${s.activity?`**Activity:** ${s.activity}\n\n`:""}${s.answer?`**Answer:** ${s.answer}\n\n`:""}${s.sourceIds?.length?`Sources: ${s.sourceIds.join(", ")}\n`:s.source?`Source: ${s.source}\n`:""}`).join("\n")};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));a.download=`${(result.title||"study-material").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.${ext}`;a.click();URL.revokeObjectURL(a.href)}
 async function uploadPdf(selectedFile?:File){
   const activeFile=selectedFile||pdfFile;if(!activeFile)return;if(missingUploadFields.length){setShowUploadErrors(true);setUploadStatus(`Please fill the missing ${missingUploadFields.join(", ")} field${missingUploadFields.length>1?"s":""}. These details are required to create correct study materials.`);return;}setShowUploadErrors(false);setPendingAutoUpload(false);setSelectedPdfName(activeFile.name);setUploadOutcome("idle");setPdfFile(activeFile);setUploadingPdf(true);setUploadStatus(`Uploading ${activeFile.name} — reading and indexing automatically…`);try{const pdf=await import("pdfjs-dist");pdf.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";const data=await activeFile.arrayBuffer();const doc=await pdf.getDocument({data}).promise;let pages:{page:number;text:string}[]=[];for(let page=1;page<=doc.numPages;page++){setUploadStatus(`Reading page ${page} of ${doc.numPages}…`);pages.push({page,text:await extractPageText(activeFile,page)});}const readableChars=pages.reduce((sum,item)=>sum+item.text.trim().length,0);if(readableChars<Math.max(80,doc.numPages*20)){setUploadStatus("Scanned PDF detected — running OCR…");const form=new FormData();form.append("file",activeFile);const ocrResponse=await fetch("/api/rag/ocr",{method:"POST",body:form,credentials:'include'});const ocr=await ocrResponse.json();if(!ocrResponse.ok)throw new Error(ocr.error||"OCR failed");pages=ocr.pages;}setUploadStatus("Indexing textbook and saving its details…");const response=await fetch("/api/rag/ingest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:activeFile.name,pages,subject:uploadSubject,grade,syllabus:uploadSyllabus,sourceLanguage:uploadLanguage,learningLanguage}),credentials:'include'});const indexed=await response.json();if(!response.ok)throw new Error(indexed.error||"Could not index this PDF");try{await savePdf(indexed.document.id,activeFile)}catch{}setSourceLanguage(uploadLanguage);setTeachingLanguage(learningLanguage);setMaterialLanguage(learningLanguage);await refreshDocs(indexed.document.id);setBatchStatus({});setBatchSummary("");setUploadOutcome("success");setAddingNew(false);setUploadStatus(`Upload successful — ${activeFile.name} is indexed and ready. Create its complete study-material pack below.`);setPdfFile(null);}catch(e:any){setUploadOutcome("error");setUploadStatus(`Upload failed — ${e.message||"please try again."}`);}finally{setUploadingPdf(false)}}
 return <main className="space-y-5"><header><p className="font-mono text-xs text-amber">OPENMAIC DELIVERY × DEEPTUTOR KNOWLEDGE</p><h1 className="font-display text-3xl text-chalk">Study Material Studio</h1><p className="text-sm text-chalkdim">Learn in your chosen teaching language while keeping notes, PPT, MCQs and exam practice in the selected material language. Generate each material grounded in your indexed textbook. Active AI mode: <b>{typeof window!=="undefined"?getSelectedAIMode():"byok"}</b>.</p></header>
 <section className="rounded-2xl border border-amber/40 bg-amber/10 p-4"><div className="flex flex-col gap-4"><div><div className="flex items-center gap-2"><Upload className="text-amber" size={20}/><h2 className="font-display text-xl text-chalk">Add a textbook</h2></div><p className="mt-1 text-sm text-chalkdim">Fill in the textbook details first, then choose the PDF. Uploading and indexing begin automatically.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="space-y-1"><span className="text-xs font-semibold text-chalkdim">Subject</span><select value={uploadSubject} onChange={e=>setUploadSubject(e.target.value)} className={`w-full rounded-lg border bg-board p-2.5 ${showUploadErrors&&!uploadSubject?"border-red-400 ring-2 ring-red-400/20":"border-board3"}`}><option value="">Select subject</option>{UPLOAD_SUBJECTS.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-semibold text-chalkdim">Class</span><select value={grade} onChange={e=>setGrade(e.target.value)} className={`w-full rounded-lg border bg-board p-2.5 ${showUploadErrors&&!grade?"border-red-400 ring-2 ring-red-400/20":"border-board3"}`}><option value="">Select class</option>{Array.from({length:12},(_,index)=>String(index+1)).map(item=><option key={item} value={item}>Class {item}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-semibold text-chalkdim">Syllabus</span><select value={uploadSyllabus} onChange={e=>setUploadSyllabus(e.target.value)} className={`w-full rounded-lg border bg-board p-2.5 ${showUploadErrors&&!uploadSyllabus?"border-red-400 ring-2 ring-red-400/20":"border-board3"}`}><option value="">Select syllabus</option><option value="cbse">CBSE</option><option value="kerala">Kerala State</option></select></label><label className="space-y-1"><span className="text-xs font-semibold text-chalkdim">PDF language</span><select value={uploadLanguage} onChange={e=>setUploadLanguage(e.target.value)} className={`w-full rounded-lg border bg-board p-2.5 ${showUploadErrors&&!uploadLanguage?"border-red-400 ring-2 ring-red-400/20":"border-board3"}`}><option value="">Select language</option>{UPLOAD_LANGUAGES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-semibold text-chalkdim">Learn in</span><select value={learningLanguage} onChange={e=>setLearningLanguage(e.target.value)} className={`w-full rounded-lg border bg-board p-2.5 ${showUploadErrors&&!learningLanguage?"border-red-400 ring-2 ring-red-400/20":"border-board3"}`}><option value="">Select language</option>{LEARNING_LANGUAGES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>{showUploadErrors&&!learningLanguage&&<span className="text-[10px] font-semibold text-red-300">Required</span>}</label></div>{showUploadErrors&&missingUploadFields.length>0&&<div role="alert" className="rounded-xl border border-red-400/50 bg-red-900/20 px-4 py-3 text-sm text-red-100"><b>Complete the required textbook details:</b> Please select {missingUploadFields.join(", ")}. We need this information to create accurate study materials.</div>}<label className={`group relative flex min-h-24 w-full items-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed border-amber bg-gradient-to-r from-amber/25 via-amber/10 to-leaf/10 px-5 py-4 text-chalk shadow-[0_10px_35px_rgba(232,166,38,0.16)] transition ${uploadingPdf||batchRunning?"cursor-not-allowed opacity-60":"cursor-pointer hover:-translate-y-0.5 hover:border-marigold hover:shadow-[0_14px_45px_rgba(232,166,38,0.28)]"}`}><input type="file" accept="application/pdf" className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" disabled={uploadingPdf||batchRunning} onChange={e=>{const selectedFile=e.target.files?.[0];if(selectedFile){setPdfFile(selectedFile);setSelectedPdfName(selectedFile.name);setUploadOutcome("idle");setShowUploadErrors(missingUploadFields.length>0);if(missingUploadFields.length===0){setPendingAutoUpload(false);setUploadStatus(`Starting upload — ${selectedFile.name}`);void uploadPdf(selectedFile);}else{setPendingAutoUpload(true);setUploadStatus(`PDF selected — ${selectedFile.name}. Please fill the missing ${missingUploadFields.join(", ")} field${missingUploadFields.length>1?"s":""}.`);}}e.currentTarget.value="";}}/><span className="pointer-events-none flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber text-board shadow-lg"><FileText size={27}/></span><span className="pointer-events-none min-w-0 flex-1"><span className="mb-1 inline-flex rounded-full bg-amber px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-board">Next step</span><span className="block truncate text-lg font-bold">{uploadingPdf?(selectedPdfName||"Indexing textbook…"):selectedPdfName||"Choose your textbook PDF"}</span><span className="block text-xs text-chalkdim">{uploadingPdf?"Please wait while the textbook is uploaded and indexed.":uploadOutcome==="success"?"Uploaded and indexed successfully.":uploadOutcome==="error"?"Upload failed. Tap here to choose the PDF and try again.":selectedPdfName?"PDF selected. Complete any missing details above.":"Tap here — upload and indexing start automatically."}</span></span><span className="pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber/50 bg-board/60 text-amber transition group-hover:translate-x-1 group-hover:bg-amber group-hover:text-board">{uploadingPdf?<Loader2 size={19} className="animate-spin"/>:<ArrowRight size={19}/>}</span></label></div>{uploadStatus&&<p className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${uploadOutcome==="success"?"border-leaf/40 bg-leaf/10 text-leaf":uploadOutcome==="error"?"border-red-400/40 bg-red-900/20 text-red-200":"border-board3 bg-board/50 text-chalkdim"}`}>{uploadOutcome==="success"&&<CheckCircle2 size={15}/>} {uploadStatus}</p>}</section>
<section className="rounded-2xl border border-amber/40 bg-amber/10 p-4">
  <button type="button" onClick={createAllStudyMaterials} disabled={!documentId||uploadingPdf||batchRunning} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber px-5 py-3 text-base font-bold text-board shadow-lg hover:bg-marigolddim disabled:opacity-50">{batchRunning?<Loader2 size={18} className="animate-spin"/>:<Layers3 size={18}/>} {batchRunning?"Creating every study material…":uploadingPdf?"Finish indexing, then create materials":"Create Study Materials"}</button>
</section>
 {documentId&&!addingNew?<section className="relative z-[1001] rounded-2xl border border-board3 bg-board2 p-4"><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl text-chalk">Created study materials</h2><p className="text-xs text-chalkdim">{(() => { const activeDocInfo=docs.find(d=>d.id===documentId); return activeDocInfo?`${activeDocInfo.name}${activeDocInfo.subject?` · ${activeDocInfo.subject}`:""} · `:""; })()}{Object.values(batchStatus).filter(item=>item.state==="complete").length}/{BATCH_MATERIALS.length} created</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={addAnotherPdf} disabled={batchRunning||uploadingPdf} title="Start a new textbook — resets the form below so you can index a different subject or class" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-leaf/50 bg-leaf/10 px-5 py-2.5 font-semibold text-leaf hover:bg-leaf/20 disabled:opacity-50"><Upload size={16}/> Add Another PDF</button>{Object.values(batchStatus).some(item=>item.state==="error")&&<button type="button" onClick={()=>createAllStudyMaterials(true)} disabled={batchRunning||uploadingPdf} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300/50 bg-red-900/20 px-5 py-2.5 font-semibold text-red-100 hover:bg-red-900/35 disabled:opacity-50"><Loader2 size={16} className={batchRunning?"animate-spin":""}/> {batchRunning?"Retrying failed materials…":"Retry failed materials only"}</button>}<button type="button" onClick={()=>createAllStudyMaterials(false)} disabled={batchRunning||uploadingPdf} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber px-5 py-2.5 font-semibold text-board hover:bg-marigolddim disabled:opacity-50">{batchRunning?<Loader2 size={16} className="animate-spin"/>:<Layers3 size={16}/>} {batchRunning?"Creating all materials at once…":"Create all materials again"}</button></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{BATCH_MATERIALS.map(([id,label])=>{const item=batchStatus[id]||{state:"not-created",message:"Not created yet"};return <div key={`${id}-${label}`} className={`rounded-xl border p-3 ${item.state==="complete"?"border-leaf/40 bg-leaf/10":item.state==="error"?"border-red-400/40 bg-red-900/10":"border-board3 bg-board"}`}>
                {item.state==="complete" ? (
                  <button onClick={()=>openCreatedMaterial(id)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-leaf"/>{label}</span>
                      <span className="font-mono text-[10px] uppercase text-leaf">Created</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-chalkdim">{item.message}</p>
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span className="flex items-center gap-2">{item.state==="running"?<Loader2 size={14} className="animate-spin text-amber"/>:<FileText size={14} className="text-chalkdim"/>}{label}</span>
                      <span className={`font-mono text-[10px] uppercase ${item.state==="error"?"text-red-200":item.state==="running"||item.state==="waiting"?"text-amber":"text-chalkdim"}`}>{item.state==="error"?"Failed":item.state==="running"||item.state==="waiting"?"Creating":"Not created"}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-chalkdim">{item.message}</p>
                  </div>
                )}
              </div>})}</div>{batchSummary&&<div className="mt-4 flex flex-col gap-3 rounded-xl border border-leaf/40 bg-leaf/10 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-chalk">{batchSummary}</p><span className="text-white">Go to RAG Classroom for today's Class</span></div>}</section>
 :addingNew&&docs.length>0?<div className="flex items-center justify-between rounded-xl border border-dashed border-board3 bg-board2/60 p-3 text-sm text-chalkdim"><span>Adding a new textbook — fill in the details below, or</span><button type="button" onClick={()=>setAddingNew(false)} className="font-semibold text-amber hover:underline">cancel and go back</button></div>:null}
 {error&&<div className="rounded-lg border border-red-500 bg-red-950 p-4 text-center font-bold text-red-100"><p>Gemini is inactive.</p><p className="mt-1 text-sm font-normal">Enter a new API key in the Settings page.</p></div>}
 {result&&(materialType==="ppt"?<PptSlideDeck material={result}/>:materialType==="quiz_bank"?<McqQuizDeck material={result}/>:<section className="rounded-2xl border border-board3 bg-board2 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-amber">{result.engine||selected?.[2]} ENGINE · {result._provider||"provider"}</p>{result._warning&&<p className="mt-1 text-xs text-amber">{result._warning}</p>}<h2 className="font-display text-2xl">{result.title}</h2><p className="mt-2 text-chalkdim">{result.overview}</p></div><div className="flex flex-wrap gap-2">{offlineSaved&&<span className="flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-200"><HardDrive size={15}/> Saved offline</span>}<button onClick={()=>download("md")} className="flex items-center gap-1 rounded-lg border border-board3 px-3 py-2"><FileText size={16}/> Markdown</button><button onClick={()=>download("json")} className="flex items-center gap-1 rounded-lg border border-board3 px-3 py-2"><Download size={16}/> JSON</button></div></div><div className="mt-5 space-y-4">{(result.sections||[]).map((s:any,i:number)=><article key={i} className="rounded-xl bg-board p-4"><h3 className="font-display text-xl">{i+1}. {s.heading}</h3><p className="mt-2 whitespace-pre-wrap leading-7">{s.content}</p>{s.visual&&<div className="mt-4 rounded-xl border border-board3 bg-board2 p-3"><p className="mb-2 font-mono text-[10px] uppercase text-chalkdim">Generated visual</p><DiagramRenderer visual={s.visual}/></div>}{s.activity&&<p className="mt-3 text-amber"><b>Activity:</b> {s.activity}</p>}{s.answer&&<details className="mt-2"><summary>Show answer</summary><p className="mt-2 text-chalkdim">{s.answer}</p></details>}<p className="mt-3 font-mono text-xs text-chalkdim">{s.sourceIds?.join(", ")||s.source}</p></article>)}</div></section>)}
 {!docs.length&&<section className="rounded-xl border border-amber/30 bg-amber/10 p-4"><BookOpen className="mb-2"/><b>Index a textbook first</b><p className="text-sm text-chalkdim">Open RAG Classroom, upload a text-based PDF, then return here.</p></section>}</main>
}
