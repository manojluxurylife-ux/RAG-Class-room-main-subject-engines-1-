import { safeStringify } from "@/lib/safe-storage";
/**
 * Student Gemini BYOK key pool.
 *
 * Keys stay in this browser only. Calls go directly to Google's Gemini API.
 * Multiple keys can be saved; quota/rate-limit failures rotate automatically.
 */

const LEGACY_KEY_STORAGE = "gg_student_gemini_key";
const POOL_STORAGE = "gg_student_gemini_keys_v2";
export const GEMINI_TEXT_MODEL = "gemini-3.1-flash-lite";
const MODEL = GEMINI_TEXT_MODEL;

export type GeminiKeyState = {
  id: string;
  key: string;
  addedAt: number;
  lastUsedAt?: number;
  exhaustedOn?: string;
  cooldownUntil?: number;
  invalid?: boolean;
  lastError?: string;
  validatedAt?: number;
  validationModel?: string;
};

type KeyPool = { version: 2; activeId?: string; keys: GeminiKeyState[] };

/** Gemini API keys usually start with AIza or AQ and contain 39+ characters. */
export function isValidGeminiKey(key: string): boolean {
  return /^(AIza[A-Za-z0-9_\-]{35}|AQ\.?[A-Za-z0-9_\-]{35,})$/.test(key.trim());
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeId(key: string): string {
  return `${key.slice(0, 6)}-${key.slice(-4)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyPool(): KeyPool { return { version: 2, keys: [] }; }

function readPool(): KeyPool {
  if (typeof window === "undefined") return emptyPool();
  try {
    const raw = localStorage.getItem(POOL_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as KeyPool;
      if (parsed?.version === 2 && Array.isArray(parsed.keys)) {
        // A key exhausted yesterday becomes eligible automatically today.
        const today = todayLocal();
        let changed = false;
        for (const item of parsed.keys) {
          if (item.exhaustedOn && item.exhaustedOn !== today) {
            delete item.exhaustedOn;
            delete item.lastError;
            changed = true;
          }
          if (item.cooldownUntil && item.cooldownUntil <= Date.now()) {
            delete item.cooldownUntil;
            changed = true;
          }
        }
        if (changed) localStorage.setItem(POOL_STORAGE, safeStringify(parsed));
        return parsed;
      }
    }
  } catch { /* recover below */ }

  // One-time migration from the original single-key storage.
  const legacy = localStorage.getItem(LEGACY_KEY_STORAGE);
  if (legacy && isValidGeminiKey(legacy)) {
    const item: GeminiKeyState = { id: makeId(legacy), key: legacy, addedAt: Date.now() };
    const pool: KeyPool = { version: 2, activeId: item.id, keys: [item] };
    localStorage.setItem(POOL_STORAGE, safeStringify(pool));
    return pool;
  }
  return emptyPool();
}

function writePool(pool: KeyPool) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POOL_STORAGE, safeStringify(pool));
  const active = pool.keys.find(k => k.id === pool.activeId) || pool.keys[0];
  if (active) localStorage.setItem(LEGACY_KEY_STORAGE, active.key);
  else localStorage.removeItem(LEGACY_KEY_STORAGE);
  window.dispatchEvent(new CustomEvent("gemini-key-pool-changed"));
}

function usable(item: GeminiKeyState): boolean {
  return !item.invalid && item.exhaustedOn !== todayLocal() && (!item.cooldownUntil || item.cooldownUntil <= Date.now());
}

function orderedUsable(preferredKey?: string): GeminiKeyState[] {
  const pool = readPool();
  const available = pool.keys.filter(usable);
  const preferred = preferredKey ? available.find(k => k.key === preferredKey) : undefined;
  const active = available.find(k => k.id === pool.activeId);
  const first = preferred || active;
  return first ? [first, ...available.filter(k => k.id !== first.id)] : available;
}

/**
 * Exposes the same rotation order used internally by withKeyRotation, for
 * callers that can't route through callGeminiClient/etc. (e.g. the Gemini
 * Live API's WebSocket-based connect(), which has to pick a key BEFORE
 * opening the socket rather than retrying inside a single fetch()). Every
 * currently-usable key is returned, active/preferred key first, so the
 * caller can walk the list and try the next one on failure.
 */
export function orderedUsableKeys(preferredKey?: string): GeminiKeyState[] {
  return orderedUsable(preferredKey);
}

export const studentKey = {
  /** Adds a key without deleting previously saved keys. Duplicate keys are ignored. */
  save(key: string) {
    if (typeof window === "undefined") return false;
    const clean = key.trim();
    if (!isValidGeminiKey(clean)) return false;
    const pool = readPool();
    let item = pool.keys.find(k => k.key === clean);
    if (!item) {
      item = { id: makeId(clean), key: clean, addedAt: Date.now() };
      pool.keys.push(item);
    } else {
      item.invalid = false;
      delete item.exhaustedOn;
      delete item.cooldownUntil;
      delete item.lastError;
    }
    pool.activeId = item.id;
    writePool(pool);
    return true;
  },

  get(): string | null {
    if (typeof window === "undefined") return null;
    return orderedUsable()[0]?.key || null;
  },

  getSaved(): string | null {
    const pool = readPool();
    return pool.keys.find(item => item.id === pool.activeId)?.key || pool.keys[0]?.key || null;
  },

  getAll(): GeminiKeyState[] { return readPool().keys.map(k => ({ ...k })); },

  setActive(id: string) {
    const pool = readPool();
    if (!pool.keys.some(k => k.id === id)) return false;
    pool.activeId = id;
    writePool(pool);
    return true;
  },

  rotateActive() {
    const pool = readPool();
    if (pool.keys.length <= 1) return;
    const currentIndex = pool.keys.findIndex(k => k.id === pool.activeId);
    const nextIndex = (currentIndex + 1) % pool.keys.length;
    pool.activeId = pool.keys[nextIndex].id;
    writePool(pool);
  },

  remove(idOrKey: string) {
    const pool = readPool();
    pool.keys = pool.keys.filter(k => k.id !== idOrKey && k.key !== idOrKey);
    if (!pool.keys.some(k => k.id === pool.activeId)) pool.activeId = pool.keys[0]?.id;
    writePool(pool);
  },

  clear() { if (typeof window !== "undefined") writePool(emptyPool()); },

  masked(key?: string): string | null {
    const k = key || studentKey.get();
    if (!k) return null;
    return k.slice(0, 6) + "•".repeat(Math.max(4, k.length - 10)) + k.slice(-4);
  },

  hasKey(): boolean { return readPool().keys.length > 0; },
  hasValidatedKey(): boolean { return readPool().keys.some(item => usable(item) && !!item.validatedAt); },
  hasUsableKey(): boolean { return !!studentKey.get(); },
  isKeyValidated(key: string): boolean {
    const pool = readPool();
    const item = pool.keys.find(candidate => candidate.key === key);
    return !!item?.validatedAt;
  },
  availableCount(): number { return orderedUsable().length; },

  status(item: GeminiKeyState): "ready" | "daily-limit" | "cooldown" | "invalid" {
    if (item.invalid) return "invalid";
    if (item.exhaustedOn === todayLocal()) return "daily-limit";
    if (item.cooldownUntil && item.cooldownUntil > Date.now()) return "cooldown";
    return "ready";
  },

  markValidated(key: string, model = MODEL) {
    const pool = readPool();
    const item = pool.keys.find(candidate => candidate.key === key);
    if (!item) return;
    item.validatedAt = Date.now();
    item.validationModel = model;
    item.invalid = false;
    delete item.cooldownUntil;
    delete item.exhaustedOn;
    delete item.lastError;
    pool.activeId = item.id;
    writePool(pool);
  },
};

export async function validateGeminiKey(key: string): Promise<{ ok: true; model: string }> {
  const clean = key.trim();
  if (!isValidGeminiKey(clean)) throw new Error("That does not look like a valid Gemini API key.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${clean}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with OK only." }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
  });
  if (!response.ok) {
    const error = await parseError(response, "Gemini key validation failed");
    const kind = classifyFailure(error);
    markFailure(clean, kind, error.message);
    throw error;
  }
  const payload = await response.json();
  if (!(payload?.candidates?.[0]?.content?.parts || []).some((part: any) => String(part?.text || "").trim())) throw new Error("Gemini accepted the key but returned no response.");
  return { ok: true, model: MODEL };
}

/**
 * Small summary for the RAG Classroom sidebar's "BYOK Status" card.
 * Deliberately only reports numbers this file actually tracks — no
 * per-key request counter or "time left" clock exists anywhere in the
 * key-pool storage, so this does NOT invent a "384/1000 requests" or
 * "10h 24m left" style readout the way the mockup showed; that would
 * be fabricated data. What IS real and shown instead: the masked
 * active key, how many keys are saved total, and how many of those are
 * currently usable (not daily-limited/cooldown/invalid).
 */
export function getKeyPoolStatus(): { activeMasked: string | null; totalKeys: number; usableKeys: number; requestsToday: number; dailyLimit: number } {
  const all = studentKey.getAll();
  const usable = all.filter(k => studentKey.status(k) === "ready").length;
  return {
    activeMasked: studentKey.masked(),
    totalKeys: all.length,
    usableKeys: usable,
    // No real per-key request counter exists yet — see note above.
    requestsToday: 0,
    dailyLimit: 0,
  };
}

class GeminiHttpError extends Error {
  constructor(public status: number, public payload: any, message: string) { super(message); }
}

async function parseError(res: Response, prefix = "Gemini error"): Promise<GeminiHttpError> {
  const payload = await res.json().catch(() => ({}));
  const message = payload?.error?.message || `${prefix} ${res.status}`;
  return new GeminiHttpError(res.status, payload, message);
}

export function classifyFailure(err: unknown): "daily" | "temporary" | "invalid" | "other" {
  if (!(err instanceof GeminiHttpError)) return "other";
  const msg = `${err.message} ${safeStringify(err.payload || {})}`.toLowerCase();
  console.error("Gemini API failure:", { status: err.status, msg });
  if (err.status === 400 && /(api key not valid|api_key_invalid|invalid api key)/.test(msg)) return "invalid";
  if (err.status === 401 || err.status === 403) return "other"; // Treat as transient/other to avoid permanent disablement
  if (err.status === 429) {
    if (/(per day|requests per day|daily|rpd|generate_requests_per_day|quota.*day|exceeded quota)/.test(msg)) return "daily";
    return "temporary";
  }
  if (err.status >= 500) return "temporary";
  return "other";
}

export function markFailure(key: string, kind: ReturnType<typeof classifyFailure>, message: string) {
  const pool = readPool();
  const item = pool.keys.find(k => k.key === key);
  if (!item) return;
  item.lastError = message.slice(0, 500);
  if (kind === "daily") item.exhaustedOn = todayLocal();
  else if (kind === "temporary") item.cooldownUntil = Date.now() + 60_000;
  else if (kind === "invalid") item.invalid = true;
  writePool(pool);
}

export function markSuccess(key: string) {
  const pool = readPool();
  const item = pool.keys.find(k => k.key === key);
  if (!item) return;
  item.lastUsedAt = Date.now();
  delete item.cooldownUntil;
  delete item.lastError;
  pool.activeId = item.id;
  writePool(pool);
}

/**
 * classifyFailure() (above) only understands REST-style GeminiHttpError
 * objects with a numeric .status, because it's built from a fetch()
 * Response. The Live API instead reports failures as WebSocket
 * ErrorEvent/CloseEvent objects with just a free-text message/reason —
 * there's no status code to branch on. This mirrors the same keyword
 * matching classifyFailure uses so a quota/auth failure on a Live
 * session benches that key for rotation exactly like a REST failure
 * would, instead of silently doing nothing (the previous behaviour,
 * which is why a quota error on the live camera/mic doubt session never
 * moved on to the student's other 4 keys).
 */
export function classifyLiveFailure(message: string): "daily" | "temporary" | "invalid" | "other" {
  const msg = (message || "").toLowerCase();
  if (/(api key not valid|api_key_invalid|invalid api key|permission_denied|unauthorized)/.test(msg)) return "invalid";
  if (/(quota|resource_exhausted|rate limit|429|exceeded)/.test(msg)) {
    if (/(per day|requests per day|daily|rpd|generate_requests_per_day|quota.*day)/.test(msg)) return "daily";
    return "temporary";
  }
  if (/(unavailable|internal|5\d\d)/.test(msg)) return "temporary";
  return "other";
}

function noKeyMessage(): string {
  const all = readPool().keys;
  if (!all.length) return "No Gemini API key is saved. Add a key in Settings.";
  const today = todayLocal();
  const detail = describePoolStatus(all);
  if (all.every(k => k.exhaustedOn === today || k.invalid)) {
    return `All ${all.length} saved Gemini keys have reached today's limit or are invalid (${detail}). Add another key, or try again tomorrow.`;
  }
  return `All ${all.length} saved Gemini keys are temporarily rate-limited (${detail}). Try again shortly or add another key.`;
}

/**
 * Turns the pool into a short, human-readable "which key did what" list —
 * e.g. "AIza••1234 daily-limit, AIza••5678 cooldown" — so a failure
 * message can actually name the keys it tried instead of just saying
 * "quota exceeded" with no indication of which of the student's several
 * saved keys that refers to.
 */
export function describePoolStatus(keys: GeminiKeyState[] = readPool().keys): string {
  if (!keys.length) return "no keys saved";
  return keys.map(k => `${studentKey.masked(k.key)} ${studentKey.status(k)}`).join(", ");
}

async function withKeyRotation<T>(preferredKey: string | undefined, operation: (key: string) => Promise<T>): Promise<T> {
  // Ensure a directly supplied valid key is in the pool for future rotation.
  if (preferredKey && isValidGeminiKey(preferredKey)) studentKey.save(preferredKey);
  const candidates = orderedUsable(preferredKey);
  if (!candidates.length) throw new Error(noKeyMessage());

  let lastError: unknown;
  for (const item of candidates) {
    try {
      const result = await operation(item.key);
      markSuccess(item.key);
      return result;
    } catch (err) {
      lastError = err;
      const kind = classifyFailure(err);
      if (kind === "daily" || kind === "temporary" || kind === "invalid") {
        markFailure(item.key, kind, err instanceof Error ? err.message : String(err));
        continue;
      }
      throw err;
    }
  }
  const classified = classifyFailure(lastError);
  if (classified === "daily" || classified === "invalid") throw new Error(noKeyMessage());
  if (classified === "temporary") throw new Error(`All ${candidates.length} saved Gemini keys are temporarily rate-limited (${describePoolStatus()}). Try again shortly or add another key.`);
  throw lastError instanceof Error ? lastError : new Error("Gemini request failed.");
}

function extractText(data: any): string {
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("\n");
  if (!text) throw new Error("Empty response from Gemini.");
  return text;
}

export interface GeminiClientOptions {
  /** Raise for big structured outputs (full lessons/materials). The old
   *  flat 8192 cap silently truncated multi-scene lesson JSON — jsonrepair
   *  then salvaged a prefix, and every scene after the cut lost its
   *  whiteboardCommands/visual fields. That was the root cause of
   *  "plain-text lessons, whiteboard writes only one or two lines". */
  maxOutputTokens?: number;
  /** Ask Gemini for application/json — dramatically better schema
   *  compliance for structured tasks than prose-with-fences. */
  json?: boolean;
}

export async function callGeminiClient(system: string, userContent: string, apiKey?: string, options: GeminiClientOptions = {}): Promise<string> {
  return withKeyRotation(apiKey, async key => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: {
          maxOutputTokens: options.maxOutputTokens ?? 8192,
          temperature: 0.4,
          ...(options.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) throw await parseError(res);
    return extractText(await res.json());
  });
}

export async function callGeminiTtsClient(text: string, languageCode = "ml-IN", apiKey?: string): Promise<{ data: string; mimeType: string }> {
  // The classroom intentionally uses one Kore teacher voice for both the
  // English textbook reading and Malayalam explanation. Older callers
  // pass ml-IN for the whole lesson, so detect an English-only passage
  // and give TTS the matching locale without changing the speaker.
  const effectiveLanguageCode = languageCode === "ml-IN" && !/[\u0D00-\u0D7F]/.test(text) ? "en-IN" : languageCode;
  const spokenLanguage = effectiveLanguageCode === "ml-IN" ? "Malayalam" : effectiveLanguageCode === "en-IN" ? "English" : "the requested language";
  return withKeyRotation(apiKey, async key => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Use the same warm female-presenting AI teacher voice. Read this classroom narration naturally and clearly in ${spokenLanguage}. Keep English technical terms pronounced naturally: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { languageCode: effectiveLanguageCode, voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
      }),
    });
    window.clearTimeout(timeout);
    if (!res.ok) throw await parseError(res, "Gemini Malayalam voice error");
    const payload = await res.json();
    const part = (payload?.candidates?.[0]?.content?.parts || []).find((item: any) => item.inlineData?.data || item.inline_data?.data);
    const audio = part?.inlineData || part?.inline_data;
    if (!audio?.data) throw new Error("Gemini did not return Malayalam audio.");
    return { data: audio.data, mimeType: audio.mimeType || audio.mime_type || "audio/L16;rate=24000" };
  });
}

export async function callGeminiClientVision(system: string, textPrompt: string, imageBase64: string, mimeType: string, apiKey?: string): Promise<string> {
  return withKeyRotation(apiKey, async key => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: textPrompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
      }),
    });
    if (!res.ok) throw await parseError(res, "Gemini vision error");
    return extractText(await res.json());
  });
}

export async function callGeminiClientStream(
  system: string,
  textPrompt: string,
  apiKey: string | undefined,
  onChunk: (textDelta: string) => void,
  image?: { base64: string; mimeType: string },
): Promise<void> {
  // Rotation is safe only before a stream emits content. A mid-stream failure is
  // surfaced to avoid duplicating the partial answer with a second key.
  return withKeyRotation(apiKey, async key => {
    const parts: any[] = image
      ? [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }, { text: textPrompt }]
      : [{ text: textPrompt }];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
      }),
    });
    if (!res.ok || !res.body) throw await parseError(res, "Gemini stream error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedAny = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const line = frame.split("\n").find(l => l.startsWith("data: "));
        if (!line) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = (parsed?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
          if (delta) { receivedAny = true; onChunk(delta); }
        } catch { /* skip malformed frame */ }
      }
    }
    if (!receivedAny) throw new Error("Empty response from Gemini.");
  });
}

export interface GroundedSource { title: string; uri: string }

export async function callGeminiClientWithSearch(system: string, userContent: string, apiKey?: string): Promise<{ text: string; sources: GroundedSource[] }> {
  return withKeyRotation(apiKey, async key => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
      }),
    });
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
    const seen = new Set<string>();
    const sources: GroundedSource[] = [];
    for (const chunk of cand?.groundingMetadata?.groundingChunks || []) {
      const uri = chunk?.web?.uri;
      const title = chunk?.web?.title || uri;
      if (uri && !seen.has(uri)) { seen.add(uri); sources.push({ title, uri }); }
    }
    return { text, sources };
  });
}
