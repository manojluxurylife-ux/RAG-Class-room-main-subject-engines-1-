/**
 * Downloads store — logs every study-material download so the admin can
 * see what's actually being used (and by whom). Backed by Firestore.
 * Written to by /api/student/materials/[id]/download whenever a download
 * succeeds.
 */
import { collectionHelpers } from "./firestore-collection";

export interface DownloadRecord {
  id:           string;
  materialId:   string;
  materialTitle:string;
  studentId?:   string;   // may be absent for pre-login/anonymous access
  studentEmail?:string;
  studentName?: string;
  downloadedAt: string;   // ISO date
}

const col = collectionHelpers<DownloadRecord>("downloads");

export const downloadsStore = {
  all: col.all,
  log: col.create,

  async byMaterial(materialId: string): Promise<DownloadRecord[]> {
    return col.where("materialId", materialId);
  },

  async byStudent(studentId: string): Promise<DownloadRecord[]> {
    return col.where("studentId", studentId);
  },

  // ── Aggregate stats for the admin dashboard ──
  async stats() {
    const all = await col.all();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const last7d = all.filter(d => now - new Date(d.downloadedAt).getTime() < 7 * DAY).length;

    const byMaterial: Record<string, { title: string; count: number }> = {};
    for (const d of all) {
      if (!byMaterial[d.materialId]) byMaterial[d.materialId] = { title: d.materialTitle, count: 0 };
      byMaterial[d.materialId].count++;
    }
    const topMaterials = Object.entries(byMaterial)
      .map(([materialId, v]) => ({ materialId, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { total: all.length, last7d, topMaterials };
  },
};
