import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { upstashConfigured } from "../upstash-store";

export type Chunk = { id:string; documentId:string; documentName:string; page:number; text:string; terms:Record<string,number>; math?:any };
export type DocumentRecord = { id:string; name:string; createdAt:string; pages:number; chunks:number; subject?:string; grade?:string; syllabus?:string; sourceLanguage?:string; learningLanguage?:string; mathDiagnostics?:any };
type Store = { documents:DocumentRecord[]; chunks:Chunk[] };
const DATA_DIR = process.env.RAG_DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "rag-store.json");
const STOP = new Set("the a an and or of to in is are was were for with on at from by as it this that these those be been being you your we they their can will would should could about into than then also very".split(" "));

// This is a SEPARATE local-file store from lib/firestore-collection.ts's
// students/parents/materials/etc. — it was hitting the exact same
// Vercel read-only-filesystem problem (see upstash-store.ts for the
// full explanation) for anything that touches textbook ingestion/RAG:
// uploading a textbook page, asking a question grounded in one,
// Material Studio generation, and the live doubt session's textbook
// grounding all go through this file. Kept as ONE JSON blob under a
// single Redis key (mirroring the original one-file-on-disk shape
// exactly, so every function below is otherwise unchanged) rather than
// splitting into per-document keys — simplest correct fix for a
// school's-worth of textbooks; worth revisiting only if the document
// catalog grows large enough that a multi-MB single value becomes slow.
const REDIS_KEY = "rag:store";
let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (redisClient) return redisClient;
  const { Redis } = await import("@upstash/redis");
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  redisClient = new Redis({ url: url!, token: token! });
  return redisClient;
}

async function load(): Promise<Store> {
  if (upstashConfigured()) {
    const redis = await getRedis();
    const store = await redis.get<Store>(REDIS_KEY);
    return store || { documents: [], chunks: [] };
  }
  try { return JSON.parse(await fs.readFile(DB_FILE,"utf8")); } catch { return {documents:[],chunks:[]}; }
}
async function save(store: Store) {
  if (upstashConfigured()) {
    const redis = await getRedis();
    await redis.set(REDIS_KEY, store);
    return;
  }
  await fs.mkdir(DATA_DIR,{recursive:true}); await fs.writeFile(DB_FILE,JSON.stringify(store,null,2));
}
function tokens(s:string){ return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(x=>x.length>1&&!STOP.has(x)); }
function termMap(s:string){ const m:Record<string,number>={}; for(const t of tokens(s)) m[t]=(m[t]||0)+1; return m; }
function chunkText(text:string, target=1100, overlap=180){ const clean=text.replace(/\s+/g," ").trim(); const out:string[]=[]; let i=0; while(i<clean.length){ let end=Math.min(clean.length,i+target); if(end<clean.length){ const stop=Math.max(clean.lastIndexOf(". ",end),clean.lastIndexOf(" ",end)); if(stop>i+500) end=stop+1; } out.push(clean.slice(i,end).trim()); if(end>=clean.length) break; i=Math.max(i+1,end-overlap); } return out.filter(Boolean); }
export async function ingest(name:string,pages:{page:number;text:string;math?:any}[],metadata:{subject?:string;grade?:string;syllabus?:string;sourceLanguage?:string;learningLanguage?:string}={},mathDiagnostics?:any){ const store=await load(); const id=crypto.randomUUID(); const chunks:Chunk[]=[]; for(const p of pages){ for(const text of chunkText(p.text)){ chunks.push({id:crypto.randomUUID(),documentId:id,documentName:name,page:p.page,text,terms:termMap(text),math:p.math}); } } const doc={id,name,createdAt:new Date().toISOString(),pages:pages.length,chunks:chunks.length,subject:metadata.subject||undefined,grade:metadata.grade||undefined,syllabus:metadata.syllabus||undefined,sourceLanguage:metadata.sourceLanguage||undefined,learningLanguage:metadata.learningLanguage||undefined,mathDiagnostics}; store.documents.unshift(doc); store.chunks.push(...chunks); await save(store); return doc; }
export async function listDocuments(){ return (await load()).documents; }
export async function deleteDocument(documentId:string){ const store=await load(); const exists=store.documents.some(document=>document.id===documentId); if(!exists)return false; store.documents=store.documents.filter(document=>document.id!==documentId); store.chunks=store.chunks.filter(chunk=>chunk.documentId!==documentId); await save(store); return true; }
// Plain first-N chunks for a document, no query scoring — used when a
// caller (e.g. the live doubt session grounding) has a documentId but no
// specific topic yet, so search()'s term-matching would return nothing.
export async function firstChunks(documentId:string,k=6){ const store=await load(); return store.chunks.filter(c=>c.documentId===documentId).slice(0,k); }
export async function rangeChunks(documentId:string,pageStart:number,pageEnd:number,k=40){ const store=await load(); return store.chunks.filter(c=>c.documentId===documentId&&c.page>=pageStart&&c.page<=pageEnd).sort((a,b)=>a.page-b.page).slice(0,k); }
export async function search(query:string,k=6,documentId?:string){ const store=await load(); const q=termMap(query); const qterms=Object.keys(q); return store.chunks.filter(c=>!documentId||c.documentId===documentId).map(c=>{ let score=0; for(const t of qterms){ if(c.terms[t]) score+=(1+Math.log(c.terms[t]))*(1+Math.log(q[t])); } const phrase=query.toLowerCase(); if(phrase.length>4&&c.text.toLowerCase().includes(phrase)) score+=8; return {...c,score}; }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,k); }
