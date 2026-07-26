"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Wifi, WifiOff, Download, Loader2, AlertTriangle } from "lucide-react";
import { Card, PageHeader, Button } from "@/components/ui";
import { studentSession, type StudentProfile } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import { studentKey } from "@/lib/student-key";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { GeminiKeySetup } from "@/components/GeminiKeySetup";
import { offlineAI, type OfflineStatus, type OfflineVisionStatus } from "@/lib/offline-ai";
import { SERVER_AI_ENABLED } from "@/lib/ai-features";
import type { TeachingStyle } from "@/lib/language-preferences";

const LANGUAGES = SUPPORTED_LANGUAGES.map(l => ({ id: l.id, label: l.label }));

const CLASSES  = ["V","VI","VII","VIII","IX","X","XI","XII"];
const SYLLABI  = [
  { id: "cbse",      label: "CBSE (NCERT)" },
  { id: "kerala",    label: "Kerala State" },
  { id: "tamilnadu", label: "Tamil Nadu" },
  { id: "karnataka", label: "Karnataka" },
];

type AIMode = "server" | "byok" | "offline";

export default function StudentProfilePage() {
  const router     = useRouter();
  const [profile,  setProfile]  = useState<StudentProfile | null>(null);
  const [language, setLanguage] = useState("malayalam");
  const [sourceLanguage, setSourceLanguage] = useState("english");
  const [materialLanguage, setMaterialLanguage] = useState("english");
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyle>("target_with_english_terms");
  const [className, setClassName] = useState("VIII");
  const [syllabus, setSyllabus] = useState("cbse");
  const [saved,    setSaved]    = useState(false);
  const [quizGating, setQuizGating] = useState(true);
  // undefined = "no preference set" = all subjects shown by default (opt-out)
  const [subjectPrefs, setSubjectPrefs] = useState<string[] | undefined>(undefined);

  // AI mode
  const [aiMode,         setAiMode]         = useState<AIMode>("byok");
  const [offlineStatus,  setOfflineStatus]  = useState<OfflineStatus>("not-downloaded");
  const [dlProgress,     setDlProgress]     = useState(0);
  const [dlLoading,      setDlLoading]      = useState(false);
  const [dlError,        setDlError]        = useState("");

  // Vision (camera) add-on for offline mode — see lib/offline-ai.ts
  const [visionStatus,   setVisionStatus]   = useState<OfflineVisionStatus>("not-downloaded");
  const [visionDlProgress, setVisionDlProgress] = useState(0);
  const [visionDlLoading,  setVisionDlLoading]  = useState(false);
  const [visionDlError,    setVisionDlError]    = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await restoreStudentSession();
      if (cancelled) return;
      if (!p) { router.push("/login"); return; }
      setProfile(p);
      setLanguage(p.teachingLanguage || p.languageId || "malayalam");
      setSourceLanguage(p.sourceLanguage || "english");
      setMaterialLanguage(p.materialLanguage || "english");
      setTeachingStyle(p.teachingStyle || "target_with_english_terms");
    setClassName(p.className || "VIII");
    setSyllabus(p.syllabus || "cbse");
    setQuizGating(p.quizGatingEnabled !== false);
    setSubjectPrefs(p.subjectPreferences);

    // Detect current AI mode
    if (typeof window !== "undefined") {
      const storedMode = (localStorage.getItem("gg_ai_mode") || "byok") as AIMode;
      const safeMode: AIMode = storedMode === "server" && !SERVER_AI_ENABLED ? "byok" : storedMode;
      if (safeMode !== storedMode) localStorage.setItem("gg_ai_mode", safeMode);
      setAiMode(safeMode);
      setOfflineStatus(offlineAI.getStatus());
      setVisionStatus(offlineAI.getVisionStatus());
    }
    })();
    return () => { cancelled = true; };
  }, [router]);

  function selectAIMode(mode: AIMode) {
    if (mode === "byok" && !studentKey.hasKey()) return; // prevent selecting without a key
    if (mode === "offline" && offlineStatus !== "ready") return;
    setAiMode(mode);
    localStorage.setItem("gg_ai_mode", mode);
  }

  async function downloadModel() {
    setDlLoading(true); setDlError(""); setDlProgress(0);
    try {
      await offlineAI.download((pct: number) => setDlProgress(pct));
      setOfflineStatus("ready");
      selectAIMode("offline");
    } catch (e: any) {
      setDlError(e.message || "Download failed. Check your connection and try again.");
      setOfflineStatus("error");
    } finally {
      setDlLoading(false);
    }
  }

  async function downloadVisionModel() {
    setVisionDlLoading(true); setVisionDlError(""); setVisionDlProgress(0);
    try {
      await offlineAI.downloadVision((pct: number) => setVisionDlProgress(pct));
      setVisionStatus("ready");
    } catch (e: any) {
      setVisionDlError(e.message || "Download failed — the vision model file may not be available yet. Check your connection and try again.");
      setVisionStatus("error");
    } finally {
      setVisionDlLoading(false);
    }
  }

  function savePreferences() {
    studentSession.update({ languageId: language, teachingLanguage: language, sourceLanguage, materialLanguage, teachingStyle, className, syllabus });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleQuizGating() {
    const next = !quizGating;
    setQuizGating(next);
    studentSession.update({ quizGatingEnabled: next });
  }

  // Matches lib/materials-store.ts's taxonomy — what admin-published
  // content is actually tagged with, not Study Materials' own subject list.
  const ADMIN_SUBJECTS = ["Maths", "Science", "Social Studies", "Language", "General"];

  function toggleSubjectPref(subject: string) {
    const current = subjectPrefs ?? ADMIN_SUBJECTS; // treat "no preference" as "all selected" for toggling purposes
    const next = current.includes(subject)
      ? current.filter(s => s !== subject)
      : [...current, subject];
    // Selecting everything again collapses back to "no preference" (undefined)
    // rather than storing a full list — keeps the opt-out default intact for
    // students who never touch this and simplifies the "all" case.
    const toStore = next.length === ADMIN_SUBJECTS.length ? undefined : next;
    setSubjectPrefs(toStore);
    studentSession.update({ subjectPreferences: toStore });
  }

  async function logout() {
    studentSession.clear();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  if (!profile) return null;

  const modeLabel: Record<AIMode, string> = {
    server:  "AI Guru server key (default)",
    byok:    "My own Gemini key (BYOK)",
    offline: "Offline mode (no internet needed)",
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your profile" />

      {/* ── Account info ── */}
      <Card className="mb-4">
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-chalkdim mb-0.5">Name</div>
            <div className="text-sm text-chalk">{profile.name}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-chalkdim mb-0.5">Email</div>
            <div className="text-sm text-chalk">{profile.email}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-chalkdim mb-0.5">School</div>
            <div className="text-sm text-chalk">{profile.schoolName || "—"}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-chalkdim mb-0.5">Location</div>
            <div className="text-sm text-chalk">
              {[profile.place, profile.district, profile.state].filter(Boolean).join(", ") || "—"}
            </div>
          </div>
        </div>

        {/* Teaching preferences */}
        <div className="border-t border-board3 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Textbook language</div>
              <select value={sourceLanguage} onChange={e=>setSourceLanguage(e.target.value)} className="w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm">
                {LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Teach me in</div>
              <select value={language} onChange={e=>setLanguage(e.target.value)} className="w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm">
                {LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Study materials in</div>
              <select value={materialLanguage} onChange={e=>setMaterialLanguage(e.target.value)} className="w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm">
                {LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Teaching style</div>
            <select value={teachingStyle} onChange={e=>setTeachingStyle(e.target.value as TeachingStyle)} className="w-full rounded-lg border border-board3 bg-board px-3 py-2 text-sm">
              <option value="target_with_english_terms">Selected language + English technical terms</option>
              <option value="target_only">Selected language only</option>
              <option value="simple_english">Simple English</option>
            </select>
            <p className="mt-2 text-xs text-chalkdim">Example: English textbook, Malayalam teaching, English notes and exams.</p>
          </label>
          <div className="mb-4" />

          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Class</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {CLASSES.map(c => (
              <button key={c} onClick={() => setClassName(c)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  className === c ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                }`}>
                Class {c}
              </button>
            ))}
          </div>

          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Syllabus</div>
          <div className="mb-5 flex flex-wrap gap-2">
            {SYLLABI.map(s => (
              <button key={s.id} onClick={() => setSyllabus(s.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  syllabus === s.id ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          <Button onClick={savePreferences}>
            {saved ? "✓ Saved!" : "Save preferences"}
          </Button>
        </div>
      </Card>

      {/* ── Study Materials pacing ── */}
      <Card className="mb-4">
        <div className="mb-1 font-display text-base text-chalk">Study Materials pacing</div>
        <p className="mb-4 text-xs text-chalkdim leading-relaxed">
          By default, each chapter's short quiz must be answered correctly before the next one
          unlocks — this helps make sure you've actually understood it. But if your school has
          already moved ahead of where you are here, turn this off so you can jump straight to
          whatever chapter you need, without waiting to clear earlier quizzes first.
        </p>
        <button onClick={toggleQuizGating}
          className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
            quizGating ? "border-marigold/40 bg-marigold/5" : "border-board3 bg-board2"
          }`}>
          <div className="text-left">
            <div className="text-sm text-chalk font-medium">
              {quizGating ? "Quizzes required to advance" : "Free navigation — quizzes optional"}
            </div>
            <div className="mt-0.5 text-xs text-chalkdim">
              {quizGating
                ? "Recommended — builds real mastery chapter by chapter"
                : "Jump to any chapter anytime, to match your school's pace"}
            </div>
          </div>
          <div className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${quizGating ? "bg-marigold" : "bg-board3"}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-board transition-all ${quizGating ? "left-[22px]" : "left-0.5"}`} />
          </div>
        </button>
      </Card>

      {/* ── Subject preferences for admin-published materials ── */}
      <Card className="mb-4">
        <div className="mb-1 font-display text-base text-chalk">Materials from your school</div>
        <p className="mb-4 text-xs text-chalkdim leading-relaxed">
          Your school/admin may publish notes, quizzes, and lesson materials for your class. Pick which
          subjects you actually want to see — leave all selected to see everything published for you.
        </p>
        <div className="flex flex-wrap gap-2">
          {ADMIN_SUBJECTS.map(s => {
            const selected = !subjectPrefs || subjectPrefs.includes(s);
            return (
              <button key={s} onClick={() => toggleSubjectPref(s)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  selected ? "border-marigold bg-marigold text-board font-semibold" : "border-board3 text-chalkdim hover:border-marigold/50"
                }`}>
                {s}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── AI mode selector ── */}
      <Card className="mb-4">
        <div className="mb-3 font-display text-base text-chalk">AI source</div>
        <p className="mb-4 text-xs text-chalkdim">
          Current: <b className="text-chalk">{modeLabel[aiMode]}</b>
        </p>

        {/* Mode cards */}
        <div className="flex flex-col gap-3 mb-4">

          {SERVER_AI_ENABLED && (
            <button onClick={() => selectAIMode("server")}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                aiMode === "server" ? "border-marigold bg-marigold/10" : "border-board3 hover:border-marigold/40"
              }`}>
              <Wifi size={18} className={aiMode === "server" ? "text-marigold" : "text-chalkdim"} />
              <div>
                <div className="text-sm font-medium text-chalk">AI Guru server key</div>
                <div className="text-xs text-chalkdim">Managed service. Requires internet.</div>
              </div>
            </button>
          )}

          {/* BYOK */}
          <div>
            <button
              onClick={() => studentKey.hasKey() ? selectAIMode("byok") : undefined}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                aiMode === "byok" ? "border-marigold bg-marigold/10"
                : studentKey.hasKey() ? "border-board3 hover:border-marigold/40"
                : "border-board3 opacity-50 cursor-default"
              }`}>
              <Wifi size={18} className={aiMode === "byok" ? "text-marigold" : "text-chalkdim"} />
              <div>
                <div className="text-sm font-medium text-chalk">My own Gemini key (BYOK)</div>
                <div className="text-xs text-chalkdim">
                  {studentKey.hasKey()
                    ? "Uses your personal free key — 1,500 lessons/day."
                    : "Set up your key below to enable this."}
                </div>
              </div>
            </button>

            {/* BYOK setup inline */}
            <div className="mt-3">
              <GeminiKeySetup onKeySaved={() => {
                setAiMode("byok");
                localStorage.setItem("gg_ai_mode", "byok");
              }} />
            </div>
          </div>

          {/* Offline */}
          <div>
            <button
              onClick={() => offlineStatus === "ready" ? selectAIMode("offline") : undefined}
              className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                aiMode === "offline" ? "border-marigold bg-marigold/10"
                : offlineStatus === "ready" ? "border-board3 hover:border-marigold/40"
                : "border-board3 opacity-60 cursor-default"
              }`}>
              <WifiOff size={18} className={aiMode === "offline" ? "text-marigold" : "text-chalkdim"} />
              <div>
                <div className="text-sm font-medium text-chalk">Offline fallback (Qwen3.5 0.8B)</div>
                <div className="text-xs text-chalkdim">
                  {offlineStatus === "ready"   ? "Downloaded — used automatically if your internet drops." :
                   offlineStatus === "downloading" ? "Downloading…" :
                   "Download once (~550 MB) so lessons still work with no signal."}
                </div>
              </div>
            </button>

            {/* Download section */}
            {offlineStatus !== "ready" && (
              <div className="mt-3 rounded-xl border border-board3 bg-board2 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm text-chalk">
                  <AlertTriangle size={14} className="text-marigold" />
                  Wi-Fi recommended for the download
                </div>
                <p className="mb-3 text-xs text-chalkdim leading-relaxed">
                  This downloads <b className="text-chalk">Qwen3.5 0.8B</b> (~550 MB), an AI
                  model that runs entirely on your device — including Malayalam and other
                  Indian languages. It's a <b className="text-chalk">backup only</b>: AI Guru
                  always tries your regular connection first, and only switches to this
                  offline model automatically if that fails. Needs roughly 1 GB of free
                  storage and RAM to run smoothly — far less than earlier versions of
                  this feature required.
                </p>

                {dlLoading && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-chalkdim">
                      <span>Downloading model…</span>
                      <span>{dlProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-board3">
                      <div className="h-full bg-marigold transition-all duration-300"
                        style={{ width: `${dlProgress}%` }} />
                    </div>
                  </div>
                )}

                {dlError && (
                  <div className="mb-3 text-xs text-terracotta">{dlError}</div>
                )}

                <button onClick={downloadModel} disabled={dlLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-board3 border border-board3 px-4 py-2 text-xs font-medium text-chalk hover:border-marigold/50 disabled:opacity-50 transition-colors">
                  {dlLoading
                    ? <><Loader2 size={13} className="animate-spin" /> Downloading…</>
                    : <><Download size={13} /> Download model (~550 MB)</>}
                </button>
              </div>
            )}

            {offlineStatus === "ready" && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-board3 bg-board2 p-3">
                <div className="text-xs text-chalkdim">
                  ✓ Ready — AI Guru will use this automatically if your connection drops.
                </div>
                <button
                  onClick={() => { offlineAI.clear(); setOfflineStatus("not-downloaded"); }}
                  className="font-mono text-[10px] text-terracotta hover:underline shrink-0 ml-3">
                  Remove
                </button>
              </div>
            )}

            {/* Vision add-on — lets the offline model also see the camera,
                used by the "Show AI Guru" panel in Classroom when
                there's no internet. Only offered once the base offline
                model above is ready, since it loads alongside it. */}
            {offlineStatus === "ready" && visionStatus !== "unsupported" && (
              <div className="mt-3 rounded-xl border border-board3 bg-board2 p-4">
                <div className="mb-1 text-sm text-chalk">Also let it see the camera (offline)</div>
                <p className="mb-3 text-xs text-chalkdim leading-relaxed">
                  An extra ~205 MB download lets the offline model look at a photo — not just
                  text — while you have no internet. Used by "Show AI Guru" in Classroom.
                </p>

                {visionStatus === "ready" ? (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-chalkdim">✓ Ready — camera works offline too.</div>
                    <button onClick={() => { offlineAI.clearVision(); setVisionStatus("not-downloaded"); }}
                      className="font-mono text-[10px] text-terracotta hover:underline shrink-0 ml-3">
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    {visionDlLoading && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-chalkdim">
                          <span>Downloading…</span>
                          <span>{visionDlProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-board3">
                          <div className="h-full bg-blue transition-all duration-300" style={{ width: `${visionDlProgress}%` }} />
                        </div>
                      </div>
                    )}
                    {visionDlError && <div className="mb-3 text-xs text-terracotta">{visionDlError}</div>}
                    <button onClick={downloadVisionModel} disabled={visionDlLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-board3 border border-board3 px-4 py-2 text-xs font-medium text-chalk hover:border-blue/50 disabled:opacity-50 transition-colors">
                      {visionDlLoading
                        ? <><Loader2 size={13} className="animate-spin" /> Downloading…</>
                        : <><Download size={13} /> Download camera support (~205 MB)</>}
                    </button>
                  </>
                )}
              </div>
            )}
            {offlineStatus === "ready" && visionStatus === "unsupported" && (
              <div className="mt-3 rounded-xl border border-board3 bg-board2 p-4 text-xs text-chalkdim">
                Offline camera analysis is disabled because no verified compatible vision projector is bundled. Images and PDFs use Gemini BYOK; local Qwen remains available for text.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Logout ── */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-chalk">Log out</div>
            <div className="text-xs text-chalkdim mt-0.5">Clears your session from this device</div>
          </div>
          <button onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-terracotta/40 px-3 py-2 text-xs text-terracotta hover:bg-terracotta/10 transition-colors">
            <LogOut size={13} /> Log out
          </button>
        </div>
      </Card>
    </div>
  );
}
