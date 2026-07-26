"use client";
import { PremiumGate } from "@/components/SubscriptionGate";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { Download, BookOpen, FileImage, Film, File, Loader2, Sparkles, ChevronDown, ChevronUp, Presentation, ChefHat, ArrowRight, Trash2, Copy, Check, Eye } from "lucide-react";
import { studentSession } from "@/lib/student-session";
import { checkDeviceStorage, type StorageStatus } from "@/lib/storage-check";
import { SaveToDriveModal } from "@/components/SaveToDriveModal";
import type { StudyMaterial } from "@/lib/study-material-schema";

const SUBJECTS = ["All","Maths","Science","Social Studies","Language","General"];

interface Material {
  id:           string;
  title:        string;
  subject:      string;
  fileType:     string;
  sizeBytes:    number;
  source:       string;
  content?:     string;
  materialKind?:string;
}

function fileIcon(type: string, source: string) {
  if (type === "pptx") return <Presentation size={16} className="text-marigold" />;
  if (source === "generated") return <Sparkles size={16} className="text-marigold" />;
  if (type === "pdf")   return <BookOpen size={16} className="text-marigold" />;
  if (type === "image") return <FileImage size={16} className="text-blue" />;
  if (type === "video") return <Film size={16} className="text-terracotta" />;
  return <File size={16} className="text-chalkdim" />;
}

function fmtSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_LABELS: Record<string, string> = {
  "lesson-plan": "Lesson Plan", "slides": "Slides", "quiz": "Quiz",
  "flashcards": "Flashcards", "mind-map": "Mind Map", "lab-manual": "Lab Manual",
  "voice-script": "Voice Script", "revision-notes": "Revision Notes",
};

function MaterialsInner() {
  const params  = useSearchParams();
  const router  = useRouter();
  const board   = params.get("board") || "cbse";
  const grade   = params.get("grade") || "8";
  const name    = params.get("name")  || "Student";

  const [materials, setMaterials]   = useState<Material[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [filter,    setFilter]      = useState("All");
  const [hiddenIds, setHiddenIds]   = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [copiedId,   setCopiedId]   = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [expanded,  setExpanded]    = useState<string | null>(null);

  // The student's OWN uploaded-textbook / prepared materials (Kitchen
  // output, Firestore study_materials) — a completely different system
  // from the admin-published library above, but a student shouldn't
  // have to know that or check two separate pages to find "my stuff."
  const [ownMaterials,        setOwnMaterials]        = useState<StudyMaterial[]>([]);
  const [loadingOwnMaterials, setLoadingOwnMaterials] = useState(true);

  // Low-storage → save-to-Drive prompt
  const [driveModalFor, setDriveModalFor] = useState<Material | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  useEffect(() => {
    const profile = studentSession.get();
    setHiddenIds(profile?.hiddenMaterialIds || []);

    const params = new URLSearchParams({ board, grade });
    if (profile?.languageId) params.set("language", profile.languageId);
    if (profile?.subjectPreferences?.length) params.set("subjects", profile.subjectPreferences.join(","));

    fetch(`/api/student/materials?${params.toString()}`)
      .then(r => r.json())
      .then(d => setMaterials(d.materials || []))
      .finally(() => setLoading(false));

    if (profile) {
      fetch(`/api/student/study-materials?studentId=${encodeURIComponent(profile.email)}`)
        .then(r => r.json())
        .then(d => setOwnMaterials(d.materials || []))
        .finally(() => setLoadingOwnMaterials(false));

      // Mark this visit — resets the "new materials" badge/banner until
      // something else gets published after this moment. Purely local,
      // no server round-trip needed for this.
      studentSession.update({ lastMaterialsCheckAt: new Date().toISOString() });
    } else {
      setLoadingOwnMaterials(false);
    }
  }, [board, grade]);

  const subjectFiltered = filter === "All" ? materials : materials.filter(m => m.subject === filter);
  const visible = showHidden ? subjectFiltered : subjectFiltered.filter(m => !hiddenIds.includes(m.id));
  const hiddenCount = subjectFiltered.filter(m => hiddenIds.includes(m.id)).length;

  // Personal "remove from my view" only — never touches the admin's
  // actual published Firestore record, which stays visible to every
  // other matching student. See lib/student-session.ts's hideMaterial().
  function hideMaterial(id: string) {
    studentSession.hideMaterial(id);
    setHiddenIds(ids => [...ids, id]);
  }
  function unhideMaterial(id: string) {
    studentSession.unhideMaterial(id);
    setHiddenIds(ids => ids.filter(x => x !== id));
  }

  async function copyMaterial(m: Material) {
    try {
      // Generated (text) materials: copy the actual content, immediately
      // usable pasted into notes/WhatsApp/etc. File-based materials: copy
      // a direct download link instead, since there's no plain-text
      // content to copy.
      const textToCopy = m.source === "generated" && m.content
        ? m.content
        : `${window.location.origin}${downloadUrl(m.id)}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard permission denied or unavailable — fail silently,
      // download button remains as the fallback path.
    }
  }

  function downloadUrl(materialId: string) {
    const profile = studentSession.get();
    const p = new URLSearchParams();
    if (profile) {
      p.set("studentId", profile.email);   // email doubles as a stable id in the current session model
      p.set("email", profile.email);
      p.set("name", profile.name);
    }
    const qs = p.toString();
    return `/api/student/materials/${materialId}/download${qs ? `?${qs}` : ""}`;
  }

  function suggestedFilename(m: Material) {
    const ext = m.source === "generated" ? "md" : (m.fileType === "pdf" ? "pdf" : m.fileType);
    return `${m.title}.${ext}`;
  }

  async function download(m: Material) {
    setDownloading(m.id);
    try {
      // Estimate this file's size in MB (fall back to a small default for
      // generated text materials, which have no sizeBytes).
      const estimatedMB = m.sizeBytes ? m.sizeBytes / (1024 * 1024) : 0.1;
      const status = await checkDeviceStorage(estimatedMB);

      if (status.supported && status.isLow) {
        // Device is tight on space — ask before filling it up further.
        setStorageStatus(status);
        setDriveModalFor(m);
      } else {
        window.open(downloadUrl(m.id), "_blank");
      }
    } finally {
      setDownloading(null);
    }
  }

  function downloadAnywayFromModal() {
    if (driveModalFor) window.open(downloadUrl(driveModalFor.id), "_blank");
    setDriveModalFor(null);
  }

  // Explicit, opt-in only — clicking this is the ONLY way an admin
  // material reaches Classroom. Nothing here happens automatically; the
  // student has to choose it. Reuses the exact sessionStorage handoff
  // already proven for the PWA Share Target and Study Materials'
  // "Just teach this now" button — Classroom's existing consumption
  // logic needs zero new code to support this.
  //
  // This replaces an earlier, broken version of this function that
  // downloaded the file and separately navigated to Classroom without
  // actually connecting the two (left as a literal TODO — never finished).
  const [sendingToClassroom, setSendingToClassroom] = useState<string | null>(null);

  async function teachFromMaterial(m: Material) {
    setSendingToClassroom(m.id);
    try {
      const res = await fetch(downloadUrl(m.id));
      if (!res.ok) throw new Error("Could not fetch this material.");
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      sessionStorage.setItem("gg_shared_file", JSON.stringify({
        base64,
        name: `${m.title}.${m.fileType === "pdf" ? "pdf" : "jpg"}`,
        type: m.fileType === "pdf" ? "application/pdf" : "image/jpeg",
      }));
      router.push("/classroom?fromShare=1");
    } catch {
      // Fall back to a plain download if the fetch/handoff fails for any
      // reason (e.g. a very large file) — the student still gets the
      // material, just not pre-loaded into Classroom.
      window.open(downloadUrl(m.id), "_blank");
    } finally {
      setSendingToClassroom(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="The Library"
        title="Your library"
        subtitle={`Files published for Class ${grade} · ${board.toUpperCase()} — to make your own, use Study Materials`}
      />

      <div className="mb-5 rounded-lg border border-board3 bg-board2 px-4 py-2 text-xs text-chalkdim">
        👋 {name} · Class {grade}
      </div>

      <Link href={`/materials/textbooks?board=${board}&grade=${grade}`} className="mb-5 block">
        <Card className="flex items-center justify-between py-3 hover:border-marigold/60 transition-colors">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-marigold" />
            <span className="text-sm text-chalk">Get your official textbook PDF</span>
          </div>
          <span className="font-mono text-[10px] text-chalkdim">NCERT / SCERT →</span>
        </Card>
      </Link>

      {/* ── Your own uploaded textbooks / prepared materials ──
          Separate system from the admin library below (Firestore
          study_materials vs materials) — a student shouldn't have to
          know that, or check two pages to find what they've made. */}
      {!loadingOwnMaterials && ownMaterials.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-base text-chalk">Your uploaded textbooks &amp; materials</div>
            <Link href="/study-materials" className="font-mono text-[10px] text-chalkdim hover:text-marigold">
              Upload another →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ownMaterials.map(m => {
              const total = m.segments.length;
              const pct   = total > 0 ? Math.round((m.progress.unlockedIndex / total) * 100) : 0;
              return (
                <Link key={m.id} href={`/classroom/study/${m.id}`}>
                  <Card className="flex flex-col gap-2 py-3.5 hover:border-marigold/60 transition-colors">
                    <div className="flex items-start gap-3">
                      <ChefHat size={16} className="text-marigold shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-chalk leading-snug truncate">{m.title}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-chalkdim">
                          {m.subject} · {total} chapter{total !== 1 ? "s" : ""} · YOUR UPLOAD
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-chalkdim shrink-0 mt-0.5" />
                    </div>
                    <div className="h-1 w-full rounded-full bg-board3 overflow-hidden">
                      <div className="h-full bg-marigold transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!loadingOwnMaterials && ownMaterials.length === 0 && (
        <Link href="/study-materials" className="mb-6 block">
          <Card className="flex items-center gap-3 py-3.5 hover:border-marigold/60 transition-colors">
            <ChefHat size={16} className="text-marigold shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-chalk">Haven't uploaded a textbook yet?</div>
              <div className="text-xs text-chalkdim">Upload a page in Study Materials — it'll show here too</div>
            </div>
            <ArrowRight size={14} className="text-chalkdim shrink-0" />
          </Card>
        </Link>
      )}

      <div className="mb-3 font-display text-base text-chalk">Published by your school</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {SUBJECTS.map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
              filter === s
                ? "border-marigold bg-marigold text-board font-semibold"
                : "border-board3 text-chalkdim hover:border-marigold/50 hover:text-chalk"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-chalkdim">
          <Loader2 size={16} className="animate-spin" /> Loading materials…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <EmptyState text={
          materials.length === 0
            ? "Your school hasn't published anything yet. Check back soon."
            : `No ${filter} materials available for Class ${grade}.`
        } />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map(m => {
          const isGenerated = m.source === "generated";
          const isExpanded  = expanded === m.id;
          return (
            <Card key={m.id} className={`flex flex-col gap-3 py-4 ${isGenerated && isExpanded ? "sm:col-span-2" : ""} ${hiddenIds.includes(m.id) ? "opacity-50" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{fileIcon(m.fileType, m.source)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-chalk leading-snug">{m.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-chalkdim">
                    {m.subject}
                    {isGenerated && m.materialKind ? ` · ${KIND_LABELS[m.materialKind] || m.materialKind}` : ""}
                    {!isGenerated && m.sizeBytes ? ` · ${fmtSize(m.sizeBytes)}` : ""}
                    {" · "}{isGenerated ? "AI-GENERATED" : m.fileType.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Inline preview for generated (text) materials */}
              {isGenerated && isExpanded && (
                <div className="max-h-80 overflow-y-auto rounded-lg border border-board3 bg-board p-3">
                  <pre className="whitespace-pre-wrap break-words font-body text-xs text-chalk leading-relaxed">
                    {m.content}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {isGenerated && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : m.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-board hover:bg-marigolddim transition-colors">
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? "Hide" : "Preview"}
                  </button>
                )}

                <button
                  onClick={() => download(m)}
                  disabled={downloading === m.id}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    isGenerated
                      ? "border border-board3 bg-board2 text-chalkdim hover:text-chalk hover:border-marigold/50"
                      : "bg-marigold text-board hover:bg-marigolddim"
                  }`}>
                  {downloading === m.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Download
                </button>

                <button
                  onClick={() => copyMaterial(m)}
                  title={isGenerated ? "Copy the content to your clipboard" : "Copy a download link to your clipboard"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk hover:border-marigold/50 transition-colors">
                  {copiedId === m.id ? <Check size={12} className="text-marigold" /> : <Copy size={12} />}
                  {copiedId === m.id ? "Copied!" : "Copy"}
                </button>

                <button
                  onClick={() => hiddenIds.includes(m.id) ? unhideMaterial(m.id) : hideMaterial(m.id)}
                  title={hiddenIds.includes(m.id)
                    ? "Add this back to your materials list"
                    : "Removes this from your own materials list only — your school's copy stays published for everyone else"}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    hiddenIds.includes(m.id)
                      ? "border-marigold/40 bg-marigold/10 text-marigold hover:bg-marigold/20"
                      : "border-board3 bg-board2 text-chalkdim hover:text-terracotta hover:border-terracotta/40"
                  }`}>
                  {hiddenIds.includes(m.id) ? <ArrowRight size={12} /> : <Trash2 size={12} />}
                  {hiddenIds.includes(m.id) ? "Restore" : "Remove"}
                </button>

                {!isGenerated && (m.fileType === "pdf" || m.fileType === "image") && (
                  <button
                    onClick={() => teachFromMaterial(m)}
                    disabled={sendingToClassroom === m.id}
                    title="Sends a copy of this material to Classroom's Teach from Textbook — nothing happens unless you click this"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-board3 bg-board2 px-3 py-1.5 text-xs text-chalkdim hover:text-chalk hover:border-marigold/50 transition-colors disabled:opacity-50">
                    {sendingToClassroom === m.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <BookOpen size={12} />}
                    Study this in Classroom
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button onClick={() => setShowHidden(v => !v)}
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-chalkdim hover:text-chalk">
          <Eye size={12} />
          {showHidden ? "Hide removed materials again" : `${hiddenCount} removed material${hiddenCount !== 1 ? "s" : ""} — show them`}
        </button>
      )}

      {driveModalFor && storageStatus && (
        <SaveToDriveModal
          materialTitle={driveModalFor.title}
          downloadUrl={downloadUrl(driveModalFor.id)}
          suggestedFilename={suggestedFilename(driveModalFor)}
          storage={storageStatus}
          onClose={() => setDriveModalFor(null)}
          onDownloadAnyway={downloadAnywayFromModal}
        />
      )}
    </div>
  );
}

function MaterialsPage() {
  return <Suspense fallback={null}><MaterialsInner /></Suspense>;
}

/**
 * Premium gate (dunning flow) — while a subscription is DEGRADED this
 * page shows the renew card instead; full/grace render normally. Has no
 * effect while ENFORCE_SUBSCRIPTIONS is false (lib/dev-mode.ts).
 */
export default function GatedMaterialsPage() {
  return <PremiumGate feature="The Library"><MaterialsPage /></PremiumGate>;
}
