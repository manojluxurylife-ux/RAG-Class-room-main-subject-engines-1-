/**
 * Caches Gemini-generated narration audio (raw PCM bytes) in IndexedDB,
 * keyed by a hash of the exact text + voice that produced it — so the
 * same paragraph's Malayalam explanation is synthesized by Gemini ONCE
 * and replayed instantly from then on, matching this app's "prepared
 * once, replayed forever" philosophy for everything else. Without this,
 * every single class replay would re-call Gemini TTS for content that
 * never changes, burning quota and adding latency on every visit.
 */
const DB_NAME = "ai-guru-tts-audio";
const STORE = "clips";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Small, fast, non-cryptographic hash — this key only needs to avoid
 *  accidental collisions between different narration text, not resist
 *  attack. FNV-1a, deterministic across sessions/devices. */
export function hashCacheKey(text: string, voice: string): string {
  let hash = 0x811c9dc5;
  const input = `${voice}::${text}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export async function getCachedTtsAudio(key: string): Promise<Uint8Array | null> {
  const db = await openDb();
  const result = await new Promise<Uint8Array | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result || null;
}

export async function setCachedTtsAudio(key: string, pcmBytes: Uint8Array): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(pcmBytes, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
