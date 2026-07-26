/**
 * Gemini Live API — real-time camera + mic session for clearing doubts.
 *
 * ADOPTED FROM: an existing working voice-agent project (same account),
 * which used this exact model + streaming pattern successfully for a
 * legal-document reading assistant. Ported here for AI Guru's
 * "Show AI Guru" doubt-clearing feature: student points their camera
 * at a textbook problem or their own working, and talks through the
 * doubt out loud in their own language — AI Guru sees the page AND
 * hears the question, and answers back in voice.
 *
 * MODEL: gemini-3.1-flash-live-preview
 *   This is a different model from the text lessons (gemini-2.5-flash in
 *   lib/teacher-prompts.ts) because live bidirectional audio/video
 *   streaming requires a model built for the Live API — a plain text
 *   model doesn't support `ai.live.connect()`.
 *
 * AUTH: Uses the SAME Gemini API key as everything else in AI Guru
 * (the student's BYOK key from lib/student-key.ts). One key, two APIs —
 * Google's Live API and REST API share the same AIza... key format.
 *
 * STREAMING FORMAT (unchanged from the source project — this is what
 * Gemini Live actually expects):
 *   Audio in:  16kHz mono PCM, base64-encoded, sent every ~4096 samples
 *   Audio out: 24kHz mono PCM, base64-encoded, played back via Web Audio
 *   Video in:  JPEG frames at 2 fps, 1024×768, base64-encoded
 */

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

export const LIVE_MODEL = "gemini-3.1-flash-live-preview";

export const INPUT_SAMPLE_RATE  = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const FRAME_RATE         = 2;      // frames/sec sent to Gemini — doesn't need to be smooth video
export const JPEG_QUALITY       = 0.6;

// ── base64 <-> bytes helpers (browser-safe, no Buffer) ──────────────────────

export function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function decodeBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, OUTPUT_SAMPLE_RATE);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}

// ── System prompt for the live doubt-clearing session ──────────────────────

export interface LiveTextbookExtract {
  page: number;
  document: string;
  text: string;
}

export function liveDoubtSystemPrompt({
  grade, boardName, gradeGuidance, languageLine, textbookName, textbookTopic, textbookExtracts,
}: {
  grade: string;
  boardName: string;
  gradeGuidance: string;
  languageLine: string;
  /** Optional — set when the student has an indexed textbook active from
   *  RAG Classroom / Material Studio (see lib/textbook-context.ts). When
   *  present, this live session is grounded in that book instead of only
   *  reacting to whatever the camera happens to see. */
  textbookName?: string;
  textbookTopic?: string;
  textbookExtracts?: LiveTextbookExtract[];
}): string {
  const hasTextbook = !!textbookName && !!textbookExtracts?.length;
  const textbookBlock = hasTextbook
    ? `\nACTIVE TEXTBOOK: the student has "${textbookName}" indexed${textbookTopic ? ` and was just studying "${textbookTopic}"` : ""}. Treat the extracts below as ground truth for that book — prefer them over your own general knowledge whenever they're relevant, and mention the page number when you draw on one (e.g. "as it says on page ${textbookExtracts![0].page}"). If the student's spoken question is about this book/topic, answer from these extracts first; if it's about something else entirely (or what they show on camera doesn't match this book), just help with that directly instead of forcing the connection.\n\nTEXTBOOK EXTRACTS:\n${textbookExtracts!.map((e, i) => `[page ${e.page}] ${e.text}`).join("\n\n")}\n`
    : "";

  return `You are AI Guru, a warm and patient Indian school maths teacher, now talking to the student live by voice, camera, and text.
The student is Class ${grade}, following the ${boardName} syllabus.
${gradeGuidance}
${languageLine}
${textbookBlock}
The student may point their camera at their textbook, notebook, or working-out and ask a question out loud or by typing. Look at whatever they show you and listen to (or read) what they ask together — don't ask them to repeat something you can already see on camera.
When the student shows you something written — a problem, an equation, their working-out — briefly confirm what you actually see before answering (e.g. "I can see you've written 2x + 5 = 15"). This catches any misreading immediately and lets the student correct you if you got it wrong, rather than confidently answering a problem you misread.
Speak naturally and briefly, like a teacher standing next to them at their desk. Keep each spoken turn short — a few sentences at most — and pause to let them respond or ask a follow-up. If they seem stuck, guide them toward the next step rather than just giving the final answer outright.`;
}

// ── Session handle type, re-exported for the component ─────────────────────

export type { LiveServerMessage, Session };
export { GoogleGenAI, Modality };
