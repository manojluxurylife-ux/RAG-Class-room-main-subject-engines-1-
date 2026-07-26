/**
 * VPS / local filesystem adapter.
 *
 * Study materials are placed in:
 *   [project root]/public/materials/
 *
 * Next.js (and nginx in production) serves /public/ as static files,
 * so files here are available at https://yourdomain.com/materials/filename.pdf
 *
 * The app doesn't need to proxy VPS files — it just redirects the student
 * to the static URL, which nginx serves directly at zero CPU cost.
 *
 * Directory structure is up to the admin:
 *   public/materials/maths/class8/
 *   public/materials/science/class6/
 *   etc.
 */
import { readdirSync, statSync, existsSync } from "fs";
import path from "path";

const MATERIALS_DIR = path.join(process.cwd(), "public", "materials");

/**
 * Resolve a caller-supplied subfolder safely inside MATERIALS_DIR.
 * Without this, /api/admin/vps?subfolder=../../.. walked straight into
 * path.join and let the caller list arbitrary server directories.
 * Absolute paths and any `..` escape are rejected by resolving and
 * prefix-checking against the materials root.
 */
function safeMaterialsPath(subfolder: string): string | null {
  if (path.isAbsolute(subfolder)) return null;
  const resolved = path.resolve(MATERIALS_DIR, subfolder);
  if (resolved !== MATERIALS_DIR && !resolved.startsWith(MATERIALS_DIR + path.sep)) return null;
  return resolved;
}

export interface VPSFile {
  name:        string;   // filename only
  relativePath:string;   // relative to public/materials/, used as sourceRef
  size:        number;
  modified:    string;
  fileType:    "pdf" | "image" | "video" | "other";
}

function fileType(name: string): "pdf" | "image" | "video" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf")                              return "pdf";
  if (["jpg","jpeg","png","webp"].includes(ext))  return "image";
  if (["mp4","webm","mkv"].includes(ext))         return "video";
  return "other";
}

export function listVPSFiles(subfolder = ""): VPSFile[] {
  const dir = safeMaterialsPath(subfolder);
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => !f.startsWith("."))
    .map(f => {
      const abs  = path.join(dir, f);
      const stat = statSync(abs);
      if (stat.isDirectory()) return null;
      const rel = subfolder ? `${subfolder}/${f}` : f;
      return { name: f, relativePath: rel, size: stat.size, modified: stat.mtime.toISOString(), fileType: fileType(f) };
    })
    .filter(Boolean) as VPSFile[];
}

/** Public URL for a VPS file served by nginx/Next.js static serving */
export function vpsPublicUrl(relativePath: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  // Same traversal guard as listVPSFiles — a sourceRef containing ../
  // must not produce a redirect outside /materials/.
  if (!safeMaterialsPath(relativePath)) {
    throw Object.assign(new Error("Invalid material path."), { status: 400 });
  }
  return `${base}/materials/${relativePath}`;
}
