"use client";
import { useState, useEffect } from "react";
import { Key, PlusCircle, Trash2, CheckCircle, ExternalLink, Clipboard } from "lucide-react";
import { studentKey, isValidGeminiKey, validateGeminiKey } from "@/lib/student-key";

const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";

export function GeminiKeySetup({
  onKeySaved,
  openManualRequest = 0,
}: {
  onKeySaved?: (key: string) => void;
  openManualRequest?: number;
}) {
  const [keys, setKeys] = useState(() => studentKey.getAll());
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function refreshKeys() {
    setKeys(studentKey.getAll());
  }

  useEffect(() => {
    const refresh = () => refreshKeys();
    window.addEventListener("gemini-key-pool-changed", refresh);
    return () => window.removeEventListener("gemini-key-pool-changed", refresh);
  }, []);

  async function handleSaveKey(key: string) {
    const k = key.trim();
    if (!isValidGeminiKey(k)) {
      setError("Invalid key format.");
      return;
    }
    try {
      const validation = await validateGeminiKey(k);
      studentKey.save(k);
      studentKey.markValidated(k, validation.model);
      refreshKeys();
      setInput("");
      setError("");
      onKeySaved?.(k);
    } catch (e: any) {
      setError("Validation failed: " + (e?.message || "Unknown error"));
    }
  }

  async function pasteFromClipboard(index: number) {
    try {
      const text = await navigator.clipboard.readText();
      await handleSaveKey(text);
    } catch {
      setError("Failed to read clipboard.");
    }
  }

  return (
    <div className="rounded-xl border border-board3 bg-board2 p-5 text-chalk">
      {/* Create Study Materials Button */}
      <a href="/material-studio" className="flex items-center gap-2 bg-amber/20 border border-amber/40 text-amber hover:bg-amber/30 px-4 py-3 rounded-xl font-bold mb-6 w-full text-center">
          Create Study Materials
      </a>

      <h2 className="text-lg font-bold mb-2">Your keys</h2>
      <p className="text-sm text-chalkdim mb-4">
        Get your free API key by clicking "Add API key" button. It will open a new tab, create an API key, return to this page, and paste it on the space given. When pasted, it will show "Connected" in green. Keys are stored only in this browser session.
      </p>

      <div className="space-y-3">
        {keys.map((item, index) => {
          const status = studentKey.status(item);
          const isConnected = status === "ready";
          return (
            <div key={item.id} className="flex items-center gap-2">
              <div className="bg-board3 text-chalk font-mono px-3 py-2 rounded-lg text-sm w-10 text-center">
                {index + 1}
              </div>
              <input
                className="flex-1 bg-board text-chalkdim px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                value={studentKey.masked(item.key) || ""}
                readOnly
              />
              <button onClick={() => pasteFromClipboard(index)} className="text-xs bg-board3 hover:bg-board p-2 rounded-lg">
                Paste
              </button>
              <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-900/30 text-orange-400 hover:bg-orange-900/50 p-2 rounded-lg">
                Add API key
              </a>
              <button onClick={() => { studentKey.remove(item.id); refreshKeys(); }} className="text-xs bg-board3 hover:bg-terracotta/20 p-2 rounded-lg text-terracotta">
                Delete
              </button>
              {isConnected && <span className="text-green-500 text-xs ml-2">Connected</span>}
            </div>
          );
        })}
        {keys.length < 10 && (
          <button onClick={() => setInput("")} className="flex items-center gap-2 text-sm text-marigold mt-4">
            <PlusCircle size={16} /> Add a new key slot
          </button>
        )}
        {input === "" && (
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 bg-board text-chalk px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
              placeholder="Paste new Gemini key here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button onClick={() => handleSaveKey(input)} className="bg-marigold text-board px-3 py-2 rounded-lg text-sm font-semibold">
              Save
            </button>
          </div>
        )}
      </div>
      {error && <div className="text-terracotta text-xs mt-4">{error}</div>}
    </div>
  );
}
