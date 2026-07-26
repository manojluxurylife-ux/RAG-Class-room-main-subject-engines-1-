/**
 * BYOK — Bring Your Own (Gemini API) Key
 *
 * Students store their own free Gemini API key on their device (localStorage).
 * Lesson and Q&A calls then go directly browser → Gemini API — the app server
 * is not involved at all, so:
 *   • No per-student API cost for the app owner
 *   • Works even if the app server is unreachable (as long as internet exists)
 *   • Student's key never leaves their device (it hits Google's servers, not ours)
 *
 * "Offline" in this context means "no dependency on the app server", not
 * "no internet". True device-offline inference would need an on-device model
 * (wllama + Qwen3.5-0.8B — see lib/offline-ai.ts) — see lib/byok.ts TODOs.
 *
 * Free Gemini key limits (Google AI Studio free tier, as of mid-2025):
 *   gemini-2.5-flash: 15 requests/min, 1,000 requests/day — plenty for a student.
 *   Get a key at https://aistudio.google.com/app/apikey
 */

const STORAGE_KEY      = "gg_byok_gemini_key";
const GEMINI_KEY_REGEX = /^AIza[0-9A-Za-z\-_]{35}$/;
const MODEL            = "gemini-3.1-flash-lite";
const API_BASE         = "https://generativelanguage.googleapis.com/v1beta/models";

export const byok = {
  // ── Key storage ─────────────────────────────────────────────────────────
  save(key: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, key.trim());
  },

  get(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  },

  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },

  hasKey(): boolean {
    return !!byok.get();
  },

  isValidKey(key: string): boolean {
    return GEMINI_KEY_REGEX.test(key.trim());
  },

  maskedKey(key: string): string {
    // Show only last 6 chars: "AIza••••••••••••••••••••••••••••••••xYz123"
    if (key.length < 10) return "••••••";
    return "AIza" + "•".repeat(key.length - 10) + key.slice(-6);
  },

  // ── Direct Gemini calls (browser → Gemini, bypassing app server) ────────

  async callText(system: string, userContent: string): Promise<string> {
    const key = byok.get();
    if (!key) throw new Error("No API key stored");

    const res = await fetch(
      `${API_BASE}/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
        }),
      },
    );

    if (res.status === 400) throw new Error("Invalid API key. Please check your key and try again.");
    if (res.status === 429) throw new Error("Free-tier limit reached. Wait a minute and try again.");
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini error (${res.status}): ${detail}`);
    }

    const data  = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text  = parts.map((p: any) => p.text || "").join("\n").trim();
    if (!text) throw new Error("Gemini returned an empty response. Try rephrasing your question.");
    return text;
  },

  async callWithImage(
    system: string,
    textPrompt: string,
    imageBase64: string,
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  ): Promise<string> {
    const key = byok.get();
    if (!key) throw new Error("No API key stored");

    const res = await fetch(
      `${API_BASE}/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: textPrompt },
            ],
          }],
          generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
        }),
      },
    );

    if (res.status === 400) throw new Error("Invalid API key. Please check your key and try again.");
    if (res.status === 429) throw new Error("Free-tier limit reached. Wait a minute and try again.");
    if (!res.ok) throw new Error(`Gemini vision error (${res.status})`);

    const data  = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text  = parts.map((p: any) => p.text || "").join("\n").trim();
    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  },
};
