"use client";
import { useState, useEffect } from "react";
import { Key, Trash2, Clipboard, PlusCircle, CheckCircle } from "lucide-react";
import { studentKey, GeminiKeyState, isValidGeminiKey, validateGeminiKey } from "@/lib/student-key";
import { VoiceGuide } from "@/components/VoiceGuide";

const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
const SCRIPT = {
  keys: [
    "You have five key slots. Click 'Add API Key' to get a free one from Google, then paste it here.",
    "Your active key is highlighted in green. When you run out of daily quota, Brain one automatically switches to the next available key."
  ]
};

export function GeminiKeyManager({ onKeyChanged, languageId }: { onKeyChanged?: () => void, languageId?: string }) {
  const [keys, setKeys] = useState<GeminiKeyState[]>([]);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const refresh = () => setKeys(studentKey.getAll());
    refresh();
    window.addEventListener("gemini-key-pool-changed", refresh);
    return () => window.removeEventListener("gemini-key-pool-changed", refresh);
  }, []);

  if (!mounted) {
    return <div className="bg-[#1a2e24] p-6 rounded-lg border border-leaf/20 animate-pulse h-96"></div>;
  }

  async function handlePaste(index: number) {
    try {
      const text = await navigator.clipboard.readText();
      const k = text.trim();
      if (!isValidGeminiKey(k)) {
        setError("Invalid key format.");
        return;
      }
      studentKey.save(k);
      setKeys(studentKey.getAll());
      setError("");
      onKeyChanged?.();
    } catch {
      setError("Failed to read clipboard.");
    }
  }

  function handleAddKey() {
    window.open(AI_STUDIO_URL, "_blank");
  }

  function handleDelete(id: string) {
    studentKey.remove(id);
    setKeys(studentKey.getAll());
    onKeyChanged?.();
  }

  return (
    <div className="bg-[#1a2e24] p-6 rounded-lg border border-leaf/20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Your keys</h2>
        <VoiceGuide lines={SCRIPT.keys} languageId={languageId || "english"} autoPlay={true} />
      </div>

      {mounted && (() => {
        // A key is "Active" (usable right now) only when status === 'ready'.
        // daily-limit / cooldown / invalid all count as Inactive — the
        // previous version only counted 'daily-limit' toward Inactive,
        // so a cooldown or invalid key was silently miscounted as Active.
        const activeCount = keys.filter(k => studentKey.status(k) === "ready").length;
        const inactiveCount = keys.length - activeCount;
        return (
          <div className="text-sm text-white mb-4 p-3 bg-board3 rounded-lg border border-leaf/30 font-medium">
            {keys.length} / 5 keys saved — <span className="text-leaf">{activeCount} Active</span>, <span className="text-terracotta">{inactiveCount} Inactive</span>
          </div>
        );
      })()}

      <div className="space-y-4">
        {[...Array(5)].map((_, i) => {
          const item = keys[i];
          const currentlyInUse = item && studentKey.get() === item.key;
          const status = item ? studentKey.status(item) : null;
          // "Active" here means usable for rotation right now (status ===
          // 'ready'); this is the per-key answer to "active or inactive",
          // separate from currentlyInUse (which key rotation would try
          // first — shown as a small extra "In use" tag below).
          const isActive = status === "ready";
          const inactiveReason = status === "daily-limit" ? "Daily Limit" : status === "invalid" ? "Invalid" : status === "cooldown" ? "Cooldown" : null;
          return (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${currentlyInUse ? 'border-leaf bg-leaf/10' : isActive ? 'border-leaf/10 bg-[#0f1d16]' : 'border-terracotta/40 bg-terracotta/10'}`}>
              <div className={`text-chalk font-mono px-3 py-2 rounded-lg text-sm w-10 text-center font-bold ${currentlyInUse ? 'bg-leaf/20' : 'bg-board3'}`}>
                {i + 1}
              </div>

              <div className="flex-1 flex items-center gap-2">
                <input
                  className={`bg-transparent px-3 py-2 text-sm font-mono focus:outline-none flex-grow ${isActive ? 'text-leaf' : 'text-chalkdim'}`}
                  value={item ? (studentKey.masked(item.key) || "") : ""}
                  placeholder="Paste key here"
                  onPaste={(e) => {
                      const k = e.clipboardData.getData('text').trim();
                      if (isValidGeminiKey(k)) {
                          studentKey.save(k);
                          setKeys(studentKey.getAll());
                          setError("");
                          onKeyChanged?.();
                      }
                  }}
                  onChange={(e) => {
                      const k = e.target.value.trim();
                      if (isValidGeminiKey(k)) {
                          studentKey.save(k);
                          setKeys(studentKey.getAll());
                          setError("");
                          onKeyChanged?.();
                      }
                  }}
                />
                {item && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 font-bold ${isActive ? 'bg-leaf text-white' : status === 'invalid' ? 'bg-red-600 text-white' : 'bg-terracotta text-white'}`}>
                      {isActive ? <CheckCircle className="w-3 h-3" /> : null}
                      {isActive ? 'Active' : `Inactive${inactiveReason ? ` · ${inactiveReason}` : ''}`}
                    </span>
                    {currentlyInUse && (
                      <span className="text-xs px-2 py-1 rounded font-bold bg-leaf/20 text-leaf border border-leaf/40">
                        In use
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => handlePaste(i)} className="text-xs bg-[#2d4d3d] text-white px-3 py-2 rounded-lg hover:bg-[#3d6550]">
                Paste
              </button>
              {!item ? (
                <button onClick={handleAddKey} className="text-xs bg-[#8d5524] text-white px-3 py-2 rounded-lg hover:bg-[#a6652a]">
                  Add API key
                </button>
              ) : (
                <button onClick={() => handleDelete(item.id)} className="text-xs bg-white text-black px-3 py-2 rounded-lg hover:bg-gray-200">
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="text-terracotta text-xs mt-4">{error}</div>}
      <p className="text-xs text-chalkdim mt-6 text-center">Keys are stored only in this browser session.</p>
    </div>
  );
}
