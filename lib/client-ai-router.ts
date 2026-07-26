"use client";

import { studentKey, callGeminiClient, type GeminiClientOptions } from "@/lib/student-key";
import { offlineAI } from "@/lib/offline-ai";
import { SERVER_AI_ENABLED } from "@/lib/ai-features";

export type AIMode = "byok" | "offline" | "server";
export type AITask = "rag_lesson" | "rag_answer" | "revision_notes" | "flashcards" | "quiz_bank" | "ppt" | "classroom" | "web_lesson" | "simulation" | "whiteboard" | "discussion" | "interactive_book" | "knowledge_base" | "research" | "personalized" | "memory" | "planning" | "visual" | "assessment" | "qa";

const MODE_KEY = "gg_ai_mode";
const LOCAL_TASKS = new Set<AITask>(["rag_answer", "revision_notes", "flashcards"]);
const LOCAL_CONTEXT_CHARS = 9000;

export class AIProviderError extends Error {
  code: "NO_BYOK_KEY" | "QUOTA" | "OFFLINE_NOT_READY" | "TASK_TOO_LARGE" | "PROVIDER_ERROR";
  constructor(code: AIProviderError["code"], message: string) { super(message); this.code = code; }
}

export function getSelectedAIMode(): AIMode {
  if (typeof window === "undefined") return "byok";
  const stored = localStorage.getItem(MODE_KEY);
  // Migrate old Server selections to BYOK while managed AI is disabled.
  if (stored === "server" && !SERVER_AI_ENABLED) {
    localStorage.setItem(MODE_KEY, "byok");
    return "byok";
  }
  if (stored === "offline") return "offline";
  if (stored === "server" && SERVER_AI_ENABLED) return "server";
  return "byok";
}

export function compactTextbookContext(extracts: Array<{page?:number;text:string;document?:string}>, maxChars = LOCAL_CONTEXT_CHARS): string {
  const clean = extracts.map((x, i) => `[S${i + 1}] page ${x.page ?? "?"}: ${String(x.text || "").replace(/\s+/g, " ").trim()}`).filter(Boolean);
  const per = Math.max(450, Math.floor(maxChars / Math.max(1, clean.length)));
  return clean.map(x => x.slice(0, per)).join("\n\n").slice(0, maxChars);
}

function friendlyProviderError(err: unknown): AIProviderError {
  const message = err instanceof Error ? err.message : String(err || "AI provider failed");
  const lower = message.toLowerCase();
  if (lower.includes("quota") || lower.includes("429") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
    return new AIProviderError("QUOTA", "Your Gemini free quota or rate limit has been reached. Wait for the quota to reset, select Offline mode for supported tasks, or use another Gemini key.");
  }
  return new AIProviderError("PROVIDER_ERROR", message);
}

async function runLocal(task: AITask, system: string, prompt: string): Promise<string> {
  if (!LOCAL_TASKS.has(task)) {
    throw new AIProviderError("TASK_TOO_LARGE", `The local Qwen model is intended for short answers, flashcards, and revision notes. ${task.replaceAll("_", " ")} needs Gemini BYOK or Server mode.`);
  }
  if (offlineAI.getStatus() !== "ready") {
    throw new AIProviderError("OFFLINE_NOT_READY", "The local Qwen model is not downloaded. Open Settings → AI source and download Brain2 first.");
  }
  try { return await offlineAI.generate(system, prompt.slice(0, 12000)); }
  catch (e) { throw friendlyProviderError(e); }
}

export async function generateWithSelectedAI(args: {
  task: AITask;
  system: string;
  prompt: string;
  serverCall?: () => Promise<string>;
  modeOverride?: AIMode;
  /** Forwarded to the BYOK Gemini call — token budget / JSON mode. */
  gemini?: GeminiClientOptions;
}): Promise<{ text: string; provider: "gemini-byok" | "qwen-local" | "gemini-server"; warning?: string }> {
  const mode = args.modeOverride || getSelectedAIMode();
  if (mode === "offline") return { text: await runLocal(args.task, args.system, args.prompt), provider: "qwen-local" };

  if (mode === "byok") {
    const key = studentKey.get();
    if (!key) throw new AIProviderError("NO_BYOK_KEY", "BYOK mode is selected, but no Gemini key is saved. Add your key in Settings or select Offline mode.");
    try { return { text: await callGeminiClient(args.system, args.prompt, key, args.gemini), provider: "gemini-byok" }; }
    catch (e) {
      if (LOCAL_TASKS.has(args.task) && offlineAI.getStatus() === "ready") {
        const original = friendlyProviderError(e);
        return { text: await runLocal(args.task, args.system, args.prompt), provider: "qwen-local", warning: `${original.message} Local Qwen was used instead.` };
      }
      throw friendlyProviderError(e);
    }
  }

  if (!SERVER_AI_ENABLED) {
    throw new AIProviderError("PROVIDER_ERROR", "Managed Server AI is temporarily disabled. Use your Gemini BYOK key or Offline mode.");
  }
  if (!args.serverCall) throw new AIProviderError("PROVIDER_ERROR", "Server AI is unavailable for this feature.");
  try { return { text: await args.serverCall(), provider: "gemini-server" }; }
  catch (e) {
    if (LOCAL_TASKS.has(args.task) && offlineAI.getStatus() === "ready") {
      return { text: await runLocal(args.task, args.system, args.prompt), provider: "qwen-local", warning: "Server Gemini was unavailable. Local Qwen was used instead." };
    }
    throw friendlyProviderError(e);
  }
}
