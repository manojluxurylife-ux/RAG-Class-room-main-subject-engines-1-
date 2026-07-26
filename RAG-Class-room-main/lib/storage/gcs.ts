import fs from "node:fs/promises";
import path from "node:path";
import { upstashConfigured } from "@/lib/upstash-store";

/**
 * lib/storage/gcs.ts — despite the filename (kept so every existing
 * import across the app didn't need touching), this was NEVER actually
 * wired up to Google Cloud Storage. It was a complete no-op stub:
 *
 *   export const uploadToGCS = async (objectName, buffer) => {};
 *
 * — every "upload" silently did nothing and reported success; every
 * "download" returned an empty file. Every textbook-page photo a
 * student uploaded, every message attachment, every admin-generated
 * slide export has been discarded, unrecoverable, since whenever this
 * was first stubbed out. This is the real implementation, backed by
 * Upstash Redis (same store already used for students/parents/
 * materials/etc. — see lib/upstash-store.ts), with a local-file
 * fallback so `next dev` keeps working with zero cloud setup exactly
 * like every other store in this app.
 *
 * STORAGE MODEL: file bytes are base64-encoded into a Redis string
 * value under `gcsfile:data:{objectName}`, with metadata (mime type,
 * size, upload time) alongside under `gcsfile:meta:{objectName}`, and
 * every object name tracked in a Redis Set (`gcsfile:index`) so
 * listGCSFolder() can do a prefix scan without Redis's discouraged
 * KEYS-over-everything pattern.
 *
 * HONEST LIMITATION — SIZE: Upstash's lower/free tiers cap individual
 * request payloads around ~1MB. A base64-encoded file is ~33% larger
 * than its raw bytes, so this comfortably handles typical compressed
 * textbook-page photos and generated JSON-ish materials, but a large
 * raw phone photo or a real multi-MB .pptx export can exceed it —
 * uploadToGCS will throw in that case rather than silently truncating.
 * If that becomes a real problem, the fix is compressing on the client
 * before upload (worth doing anyway for students on limited mobile
 * data) or moving to dedicated object storage for just those large
 * files — not a reason to keep the old silent-discard behavior.
 *
 * HONEST LIMITATION — ACCESS: signedDownloadUrl() below does NOT
 * expire and doesn't check who's asking, unlike a real GCS signed URL.
 * It relies on the object name itself being an unguessable, internally
 * generated reference (the same trust model every caller already had
 * for the string it was storing), not on possessing a real time-boxed
 * signature. Acceptable for what's stored today (textbook-page photos,
 * message attachments) but worth revisiting before storing anything
 * more sensitive.
 */

interface FileMeta {
  mimeType: string;
  size: number;
  updatedAt: string;
  [key: string]: unknown;
}

let redisClient: import("@upstash/redis").Redis | null = null;
async function getRedis() {
  if (redisClient) return redisClient;
  const { Redis } = await import("@upstash/redis");
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  redisClient = new Redis({ url: url!, token: token! });
  return redisClient;
}

// Local-dev fallback — mirrors json-store.ts's pattern: zero setup for
// `next dev` on a laptop, real storage (Upstash, above) in production.
const LOCAL_DIR = path.join(process.env.RAG_DATA_DIR || path.join(process.cwd(), "data"), "gcs-files");
function localPaths(objectName: string) {
  const safe = objectName.replace(/[^a-zA-Z0-9_.\-/]/g, "_");
  const base = path.join(LOCAL_DIR, safe);
  return { dataPath: base, metaPath: `${base}.meta.json` };
}

export async function uploadToGCS(
  objectName: string,
  buffer: Uint8Array | Buffer,
  mimeType = "application/octet-stream",
  extraMeta?: Record<string, unknown>,
): Promise<void> {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const meta: FileMeta = { mimeType, size: bytes.length, updatedAt: new Date().toISOString(), ...extraMeta };

  if (upstashConfigured()) {
    const redis = await getRedis();
    await redis.set(`gcsfile:data:${objectName}`, bytes.toString("base64"));
    await redis.set(`gcsfile:meta:${objectName}`, meta);
    await redis.sadd("gcsfile:index", objectName);
    return;
  }

  const { dataPath, metaPath } = localPaths(objectName);
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, bytes);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
}

export async function downloadFromGCS(objectName: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (upstashConfigured()) {
    const redis = await getRedis();
    const [b64, meta] = await Promise.all([
      redis.get<string>(`gcsfile:data:${objectName}`),
      redis.get<FileMeta>(`gcsfile:meta:${objectName}`),
    ]);
    if (!b64) throw new Error(`File not found: ${objectName}`);
    return { bytes: new Uint8Array(Buffer.from(b64, "base64")), contentType: meta?.mimeType || "application/octet-stream" };
  }

  const { dataPath, metaPath } = localPaths(objectName);
  const bytes = await fs.readFile(dataPath).catch(() => { throw new Error(`File not found: ${objectName}`); });
  const meta = await fs.readFile(metaPath, "utf8").then(t => JSON.parse(t) as FileMeta).catch(() => null);
  return { bytes: new Uint8Array(bytes), contentType: meta?.mimeType || "application/octet-stream" };
}

/**
 * Returns a URL the browser can fetch this file from directly — see
 * app/api/files/[id]/route.ts, which is what actually serves the bytes
 * back out via downloadFromGCS below. The id is base64url(objectName)
 * — a pre-existing convention from a route that was already sitting in
 * this codebase (built ahead of an actual gcs.ts implementation ever
 * arriving), reused here rather than inventing a second one.
 */
export async function signedDownloadUrl(objectName: string): Promise<string> {
  return `/api/files/${Buffer.from(objectName, "utf8").toString("base64url")}`;
}

export async function listGCSFolder(prefix: string): Promise<{ name: string; size: number; updated: string }[]> {
  if (upstashConfigured()) {
    const redis = await getRedis();
    const allNames = await redis.smembers("gcsfile:index");
    const matching = allNames.filter(n => n.startsWith(prefix));
    if (!matching.length) return [];
    const metas = await redis.mget<(FileMeta | null)[]>(...matching.map(n => `gcsfile:meta:${n}`));
    return matching.map((name, i) => ({ name, size: metas[i]?.size || 0, updated: metas[i]?.updatedAt || "" }));
  }

  try {
    const entries = await fs.readdir(LOCAL_DIR, { withFileTypes: true });
    const names = entries.filter(e => e.isFile() && !e.name.endsWith(".meta.json") && e.name.startsWith(prefix.replace(/[^a-zA-Z0-9_.\-/]/g, "_")));
    const results = await Promise.all(names.map(async e => {
      const metaRaw = await fs.readFile(path.join(LOCAL_DIR, `${e.name}.meta.json`), "utf8").catch(() => null);
      const meta = metaRaw ? (JSON.parse(metaRaw) as FileMeta) : null;
      return { name: e.name, size: meta?.size || 0, updated: meta?.updatedAt || "" };
    }));
    return results;
  } catch {
    return [];
  }
}

export function gcsNameToFileType(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["ppt", "pptx"].includes(ext)) return "presentation";
  if (["doc", "docx"].includes(ext)) return "document";
  if (["xls", "xlsx"].includes(ext)) return "spreadsheet";
  return "unknown";
}
