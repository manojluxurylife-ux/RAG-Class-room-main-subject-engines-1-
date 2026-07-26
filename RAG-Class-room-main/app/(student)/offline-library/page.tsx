"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Cloud, CloudDownload, CloudUpload, Download, HardDrive, RefreshCw, Trash2, WifiOff, X } from "lucide-react";
import { DiagramRenderer } from "@/components/visuals/DiagramRenderer";
import { createPortableOfflinePackage, deleteOfflineMaterial, importPortableOfflinePackage, listOfflineMaterials, type OfflineMaterialRecord } from "@/lib/offline-materials";
import { downloadOfflinePackageFromDrive, isDriveConfigured, listOfflinePackagesFromDrive, requestStudentDriveAccess, uploadOfflinePackageToDrive, type DriveOfflinePackage } from "@/lib/student-drive";

export default function OfflineLibraryPage() {
  const [items, setItems] = useState<OfflineMaterialRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [driveItems, setDriveItems] = useState<DriveOfflinePackage[]>([]);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState<string | null>(null);
  const [driveMessage, setDriveMessage] = useState("");
  const selected = useMemo(() => items.find(x => x.id === selectedId) || null, [items, selectedId]);

  async function refresh() {
    setLoading(true);
    try { setItems(await listOfflineMaterials()); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); setOnline(navigator.onLine); const sync=()=>setOnline(navigator.onLine); window.addEventListener("online",sync); window.addEventListener("offline",sync); return()=>{window.removeEventListener("online",sync);window.removeEventListener("offline",sync)}; }, []);


  function safeFilename(title: string) {
    return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "material"}.aiguru.json`;
  }

  async function connectDrive() {
    if (!online) { setDriveMessage("Connect to the internet before accessing Google Drive."); return null; }
    if (!isDriveConfigured()) { setDriveMessage("Google Drive backup is not configured for this deployment."); return null; }
    setDriveBusy("connect"); setDriveMessage("");
    try {
      const token = await requestStudentDriveAccess();
      setDriveToken(token);
      const files = await listOfflinePackagesFromDrive(token);
      setDriveItems(files);
      setDriveMessage(`Connected. ${files.length} backup${files.length === 1 ? "" : "s"} found.`);
      return token;
    } catch (e: any) { setDriveMessage(e?.message || "Could not connect Google Drive."); return null; }
    finally { setDriveBusy(null); }
  }

  async function backupToDrive(item: OfflineMaterialRecord) {
    setDriveBusy(`upload:${item.id}`); setDriveMessage("");
    try {
      const token = driveToken || await connectDrive();
      if (!token) return;
      const blob = await createPortableOfflinePackage(item);
      await uploadOfflinePackageToDrive(blob, safeFilename(item.title), item.id, token);
      setDriveItems(await listOfflinePackagesFromDrive(token));
      setDriveMessage(`“${item.title}” was backed up to your Google Drive.`);
    } catch (e: any) { setDriveMessage(e?.message || "Drive backup failed."); }
    finally { setDriveBusy(null); }
  }

  async function restoreFromDrive(file: DriveOfflinePackage) {
    setDriveBusy(`download:${file.id}`); setDriveMessage("");
    try {
      const token = driveToken || await connectDrive();
      if (!token) return;
      const blob = await downloadOfflinePackageFromDrive(file.id, token);
      const restored = await importPortableOfflinePackage(blob);
      await refresh();
      setDriveMessage(`“${restored.title}” was downloaded and is ready offline.`);
    } catch (e: any) { setDriveMessage(e?.message || "Could not restore Drive backup."); }
    finally { setDriveBusy(null); }
  }

  async function remove(id: string) {
    await deleteOfflineMaterial(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  }

  function exportJson(item: OfflineMaterialRecord) {
    const blob = new Blob([JSON.stringify(item.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "material"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (selected) {
    const data = selected.data || {};
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const segments = Array.isArray(data.segments) ? data.segments : [];
    return <main className="space-y-4">
      <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm text-chalkdim"><X size={15}/> Close material</button>
      <section className="rounded-2xl border border-board3 bg-board2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase text-amber">Available offline · {selected.kind}</p><h1 className="font-display text-2xl">{selected.title}</h1><p className="mt-2 text-sm text-chalkdim">{data.overview || data.subject || selected.topic}</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => backupToDrive(selected)} disabled={!online || !!driveBusy} className="flex items-center gap-2 rounded-lg border border-board3 px-3 py-2 text-sm disabled:opacity-50"><CloudUpload size={15}/> {driveBusy === `upload:${selected.id}` ? "Backing up…" : "Save to Drive"}</button><button onClick={() => exportJson(selected)} className="flex items-center gap-2 rounded-lg border border-board3 px-3 py-2 text-sm"><Download size={15}/> Export JSON</button></div>
        </div>
        <div className="mt-5 space-y-4">
          {sections.map((s: any, i: number) => <article key={i} className="rounded-xl bg-board p-4">
            <h2 className="font-display text-xl">{i + 1}. {s.heading}</h2>
            <p className="mt-2 whitespace-pre-wrap leading-7">{s.content}</p>
            {s.visual && <div className="mt-4"><DiagramRenderer visual={s.visual}/></div>}
            {s.activity && <p className="mt-3 text-amber"><b>Activity:</b> {s.activity}</p>}
            {s.answer && <details className="mt-2"><summary>Show answer</summary><p className="mt-2 text-chalkdim">{s.answer}</p></details>}
          </article>)}
          {segments.map((s: any, i: number) => <article key={i} className="rounded-xl bg-board p-4">
            <h2 className="font-display text-xl">{i + 1}. {s.heading}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">{(s.points || []).map((p: string, j: number) => <li key={j}>{p}</li>)}</ul>
            {s.visual && <div className="mt-4"><DiagramRenderer visual={s.visual}/></div>}
            {s.example && <div className="mt-4 rounded-lg border border-board3 p-3"><b>{s.example.problem}</b><ol className="mt-2 list-decimal pl-5">{(s.example.steps || []).map((p: string, j: number) => <li key={j}>{p}</li>)}</ol><p className="mt-2 text-amber">{s.example.answer}</p></div>}
            {s.quiz && <div className="mt-4 rounded-lg border border-board3 p-3"><b>{s.quiz.question}</b><ol className="mt-2 list-[upper-alpha] pl-5">{(s.quiz.options || []).map((o: string, j: number) => <li key={j}>{o}</li>)}</ol><details className="mt-2"><summary>Show answer</summary><p>{s.quiz.options?.[s.quiz.correctIndex]}</p></details></div>}
          </article>)}
        </div>
      </section>
    </main>;
  }

  return <main className="space-y-5">
    <header><p className="font-mono text-xs text-amber">DEVICE STORAGE</p><h1 className="font-display text-3xl">Offline Library</h1><p className="text-sm text-chalkdim">Gemini creates the material once. This copy is stored on this device and replays without Gemini, Firestore, or internet access.</p></header>
    {!online && <div className="flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm"><WifiOff size={16}/> You are offline. Device copies remain available; Google Drive becomes available after reconnecting.</div>}
    <section className="rounded-xl border border-board3 bg-board2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Cloud size={18} className="text-amber"/><h2 className="font-display text-xl">Google Drive backups</h2></div><p className="mt-1 text-sm text-chalkdim">Back up completed materials to the student’s own Drive and restore them on this or another device.</p></div>
        <button onClick={connectDrive} disabled={!online || driveBusy === "connect"} className="flex items-center gap-2 rounded-lg border border-board3 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={15}/>{driveBusy === "connect" ? "Connecting…" : driveToken ? "Refresh Drive" : "Connect Drive"}</button>
      </div>
      {driveMessage && <p className="mt-3 rounded-lg bg-board px-3 py-2 text-sm text-chalkdim">{driveMessage}</p>}
      {!!driveItems.length && <div className="mt-4 grid gap-2 sm:grid-cols-2">{driveItems.map(file => <article key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-board3 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{file.name.replace(/\.aiguru\.json$/i, "")}</p><p className="text-[10px] text-chalkdim">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : "Drive backup"}{file.size ? ` · ${Math.max(1, Math.round(Number(file.size)/1024))} KB` : ""}</p></div><button onClick={() => restoreFromDrive(file)} disabled={!!driveBusy} className="flex shrink-0 items-center gap-1 rounded-lg border border-board3 px-2 py-1.5 text-xs disabled:opacity-50"><CloudDownload size={14}/>{driveBusy === `download:${file.id}` ? "Restoring…" : "Download"}</button></article>)}</div>}
    </section>
    {loading ? <p className="text-chalkdim">Loading device library…</p> : !items.length ? <section className="rounded-xl border border-board3 bg-board2 p-5 text-center"><HardDrive className="mx-auto mb-2"/><b>No offline materials yet</b><p className="mt-1 text-sm text-chalkdim">Generate a material in Material Studio or open a prepared study course while online. It will be saved automatically.</p></section> : <section className="grid gap-3 sm:grid-cols-2">{items.map(item => <article key={item.id} className="rounded-xl border border-board3 bg-board2 p-4"><div className="flex items-start justify-between gap-3"><button onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><BookOpen size={15} className="text-amber"/><span className="font-mono text-[10px] uppercase text-chalkdim">{item.kind}</span></div><h2 className="mt-2 font-display text-lg">{item.title}</h2><p className="mt-1 truncate text-xs text-chalkdim">{item.topic || item.materialType}</p><p className="mt-2 text-[10px] text-chalkdim">Saved {new Date(item.updatedAt).toLocaleString()}</p></button><div className="flex gap-2"><button onClick={() => backupToDrive(item)} disabled={!online || !!driveBusy} aria-label="Save to Google Drive" className="rounded-lg border border-board3 p-2 text-chalkdim hover:text-amber disabled:opacity-40"><CloudUpload size={15}/></button><button onClick={() => remove(item.id)} aria-label="Delete offline copy" className="rounded-lg border border-board3 p-2 text-chalkdim hover:text-terracotta"><Trash2 size={15}/></button></div></div></article>)}</section>}
  </main>;
}
