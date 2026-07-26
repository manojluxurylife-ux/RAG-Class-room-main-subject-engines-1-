"use client";
/**
 * Student Settings — the setup room, sitting in the main menu just
 * before Materials.
 *
 * 1) ACTIVATE BRAIN1 — the student's free Gemini API key. The tab opens
 *    Google AI Studio; when the student copies their key and switches
 *    back, the clipboard is read automatically and the key pastes
 *    itself (all handled by the existing GeminiKeySetup component —
 *    reused, not duplicated). Voice guidance narrates the steps in the
 *    student's own language (pre-translated scripts, not machine-
 *    translated on the fly). On success: confetti burst, the tab turns
 *    GREEN, and a spoken + written "Your API key is successfully
 *    pasted. Congratulations!"
 *
 * 2) DOWNLOAD YOUR TEXTBOOK — uses the key the student just entered to
 *    run a REAL web search (Gemini's google_search grounding tool,
 *    lib/student-key.ts → callGeminiClientWithSearch) for the official
 *    free PDF download pages of their textbook. NCERT and the state
 *    SCERTs publish textbooks as free PDFs — this finds the right page.
 *    Every result link comes from the grounding metadata (pages the
 *    model actually consulted), never from its memory alone.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Zap, CheckCircle2, BookDown, Loader2, ExternalLink, AlertTriangle, Search, HardDriveDownload, WifiOff, ArrowRight, Brain,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { GeminiKeyManager } from "@/components/GeminiKeyManager";
import { VoiceGuide } from "@/components/VoiceGuide";
import { CelebrationBurst } from "@/components/CelebrationBurst";
import { getSetupVoiceScript } from "@/lib/setup-voice-scripts";
import { getSpeechLang } from "@/lib/web-speech";
import { studentSession } from "@/lib/student-session";
import { studentKey, validateGeminiKey, callGeminiClientWithSearch, type GroundedSource } from "@/lib/student-key";
import { offlineAI, type OfflineStatus } from "@/lib/offline-ai";
import { offlineVibeThinker, type OfflineStatus as VibeStatus } from "@/lib/offline-ai-vibethinker";
import { STUDY_SUBJECTS } from "@/lib/study-material-schema";
import { SUPPORTED_LANGUAGES, getLanguage } from "@/lib/languages";
import { SharedTextbookBrowser } from "@/components/SharedTextbookBrowser";

const BOARDS = [
  { id: "cbse",      label: "CBSE (NCERT)" },
  { id: "kerala",    label: "Kerala State (SCERT)" },
  { id: "tamilnadu", label: "Tamil Nadu" },
  { id: "karnataka", label: "Karnataka" },
];
const CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

export default function StudentSettingsPage() {
  const profile = studentSession.get();
  const languageId = profile?.languageId || "english";
  const script = getSetupVoiceScript(languageId);

  // ── Brain1 state ──
  const router = useRouter();
  const [brainActive, setBrainActive] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [justSaved,   setJustSaved]   = useState(false);
  useEffect(() => { const key=studentKey.getSaved();if(!key){setBrainActive(false);return;}validateGeminiKey(key).then(validation=>{studentKey.markValidated(key,validation.model);setBrainActive(true);}).catch(()=>setBrainActive(false)); }, []);

  function handleKeySaved() {
    setBrainActive(true);
    setJustSaved(true);
    setCelebrating(true);
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(script.geminiKeyDone);
        u.lang = getSpeechLang(languageId);
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      }
    } catch { /* voice is a bonus, never a blocker */ }
  }

  // ── Brain2: the on-device Qwen model (offline lessons) ──
  const [brain2Status,   setBrain2Status]   = useState<OfflineStatus>("not-downloaded");
  const [brain2Progress, setBrain2Progress] = useState(0);
  useEffect(() => { setBrain2Status(offlineAI.getStatus()); }, []);

  async function downloadBrain2() {
    if (brain2Status === "downloading" || brain2Status === "ready") return;
    setBrain2Status("downloading"); setBrain2Progress(0);
    try {
      await offlineAI.download(pct => setBrain2Progress(pct));
      setBrain2Status("ready");
    } catch {
      setBrain2Status("error");
    }
  }

  // ── VibeThinker-3B: a second, alternative on-device reasoning model
  // (math/code/STEM) — see lib/offline-ai-vibethinker.ts for the full
  // story. Kept fully separate from Brain2 above: independent status,
  // independent download, no shared state — a student can have either,
  // both, or neither downloaded. Not yet wired into any specific
  // generation flow (deliberately — see that file's comments); this
  // section only makes it downloadable and available. ──
  const [vibeStatus,   setVibeStatus]   = useState<VibeStatus>("not-downloaded");
  const [vibeProgress, setVibeProgress] = useState(0);
  const [vibeError,    setVibeError]    = useState("");
  useEffect(() => { setVibeStatus(offlineVibeThinker.getStatus()); }, []);

  async function downloadVibeThinker() {
    if (vibeStatus === "downloading" || vibeStatus === "ready") return;
    setVibeStatus("downloading"); setVibeProgress(0); setVibeError("");
    try {
      await offlineVibeThinker.download(pct => setVibeProgress(pct));
      setVibeStatus("ready");
    } catch (e: any) {
      setVibeStatus("error");
      setVibeError(e?.message || "Download failed.");
    }
  }

  // ── Download your textbook ──
  const [tbOpen,    setTbOpen]    = useState(false);
  const [syllabus,  setSyllabus]  = useState(profile?.syllabus || "cbse");
  const [className, setClassName] = useState(
    CLASSES.includes(profile?.grade || "") ? (profile?.grade as string) : "8");
  const [subject,   setSubject]   = useState<string>(STUDY_SUBJECTS[0]);
  const [medium,    setMedium]    = useState(languageId);
  const [searching, setSearching] = useState(false);
  const [tbError,   setTbError]   = useState("");
  const [tbAnswer,  setTbAnswer]  = useState("");
  const [tbSources, setTbSources] = useState<GroundedSource[]>([]);
  const brainRef = useRef<HTMLDivElement>(null);

  function navigateToKeys() {
    router.push("/settings/keys");
  }

  async function findTextbooks() {
    const key = studentKey.get();
    if (!key) return;
    setSearching(true); setTbError(""); setTbAnswer(""); setTbSources([]);
    try {
      const boardLabel  = BOARDS.find(b => b.id === syllabus)?.label || syllabus;
      const mediumLabel = getLanguage(medium).label;
      const system =
        "You help Indian school students find the OFFICIAL free PDF download pages for their textbooks. " +
        "NCERT (ncert.nic.in) publishes all CBSE textbooks as free PDFs, and state SCERTs (e.g. scert.kerala.gov.in / samagra.kite.kerala.gov.in for Kerala) publish state-syllabus textbooks as free PDFs. " +
        "Use web search to find the exact current download page for the requested class, subject and medium. " +
        "Prefer official government sources. Reply in 3-5 short sentences telling the student exactly where to go and what to click. Do not invent URLs — only refer to pages found by search.";
      const query =
        `Find the official free PDF download page for the ${boardLabel} Class ${className} ${subject} textbook, ${mediumLabel} medium. Where exactly can the student download it?`;
      const { text, sources } = await callGeminiClientWithSearch(system, query, key);
      setTbAnswer(text || "Here are the pages I found:");
      setTbSources(sources);
      if (!text && sources.length === 0) {
        setTbError("The search returned nothing this time — try once more, or search the web yourself.");
      }
    } catch (e: any) {
      setTbError(e.message || "Search failed. Check your internet and try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-8">
      {celebrating && <CelebrationBurst onDone={() => setCelebrating(false)} />}

      <header>
        <h1 className="text-3xl font-bold text-white">Welcome Back, {profile?.name || "Student"}! 👋</h1>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[ {title: "TOTAL LESSONS", value: "0"}, {title: "THIS WEEK", value: "0"}, {title: "DAY STREAK 🔥", value: "0"} ].map((stat, i) => (
          <div key={i} className="bg-[#1a2e24] border border-leaf/20 p-6 rounded-lg">
            <div className="text-xs font-semibold text-chalkdim mb-2 tracking-wider">{stat.title}</div>
            <div className="text-4xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* "Get set up" section */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Get set up</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="h-full flex flex-col" >
            <div ref={brainRef} className="mb-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={navigateToKeys} aria-label="Open Gemini API key setup" className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                brainActive
                  ? "border-leaf bg-leaf/15 text-leaf hover:bg-leaf/25"
                  : "border-marigold/40 bg-marigold/10 text-marigold hover:bg-marigold/20"
              }`}>
                {brainActive ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                {brainActive ? "Brain1 Active" : "Activate Brain1"}
              </button>
              <VoiceGuide lines={script.geminiKey} languageId={languageId} autoPlay={false} />
            </div>
            {justSaved && (
              <div className="mb-4 rounded-lg border border-leaf bg-leaf/10 p-3 text-sm text-leaf">
                🎉 Your API key is successfully pasted. Congratulations!
              </div>
            )}
            <p className="mb-4 text-xs text-chalkdim leading-relaxed flex-grow">
              Brain1 is your own free Gemini AI key — it powers your lessons, and it stays on this device only.
            </p>
            <div className="text-marigold text-xs font-mono cursor-pointer" onClick={navigateToKeys}>Open or replace key →</div>
            {/* Removed embedded GeminiKeyManager as it now has its own page */}
          </Card>

          <Card className="h-full flex flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <button onClick={downloadBrain2} disabled={brain2Status === "downloading" || brain2Status === "ready"}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  brain2Status === "ready"
                    ? "border-leaf bg-leaf/15 text-leaf cursor-default"
                    : "border-marigold/40 bg-marigold/10 text-marigold hover:bg-marigold/20"
                }`}>
                {brain2Status === "ready" ? <CheckCircle2 size={14} />
                  : brain2Status === "downloading" ? <Loader2 size={14} className="animate-spin" />
                  : <HardDriveDownload size={14} />}
                {brain2Status === "ready" ? "Brain2 Ready"
                  : brain2Status === "downloading" ? `Downloading… ${brain2Progress}%`
                  : "Download Brain2"}
              </button>
            </div>
            {brain2Status === "downloading" && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-board3">
                <div className="h-full bg-marigold transition-all duration-300" style={{ width: `${brain2Progress}%` }} />
              </div>
            )}
            <p className="text-xs text-chalkdim leading-relaxed flex-grow">
              Backup AI for when you're offline.
            </p>
            <div className="text-marigold text-xs font-mono cursor-pointer" onClick={downloadBrain2}>Download Qwen3.5 →</div>
          </Card>

          <Card className="h-full flex flex-col">
            <div className="mb-3 flex items-center gap-2">
              <BookDown size={16} className="text-marigold" />
              <div className="font-display text-base text-white">Download Syllabus</div>
            </div>
            <p className="text-xs text-chalkdim leading-relaxed flex-grow">
              CBSE, Kerala, Tamil Nadu, Karnataka textbooks
            </p>
            <div className="text-marigold text-xs font-mono cursor-pointer" onClick={() => setTbOpen(v => !v)}>Browse official textbooks →</div>
          </Card>
        </div>
      </section>

      {/* Extra offline brain — VibeThinker-3B (reasoning). Deliberately
          separate from the "Get set up" cards above: this is an
          optional, much bigger download (1.93GB vs Brain2's 550MB),
          not part of the standard onboarding path. */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Extra offline brain (optional)</h2>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Brain size={16} className="text-marigold shrink-0" />
            <div className="font-display text-base text-white">VibeThinker-3B</div>
            <span className="rounded-full bg-board3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chalkdim">Reasoning · Math · Code</span>
          </div>
          <p className="text-xs text-chalkdim leading-relaxed">
            A bigger, math/reasoning-focused on-device model — a backup option alongside Brain2 for when a free Gemini key isn't available.
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-marigold/30 bg-marigold/10 p-3 text-xs leading-5 text-marigold">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>1.93 GB — much bigger than Brain2 (550 MB). On phones with 3–4 GB RAM this may fail to load even after downloading fully; Brain2 is the safer choice on lower-end devices.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={downloadVibeThinker} disabled={vibeStatus === "downloading" || vibeStatus === "ready"}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                vibeStatus === "ready"
                  ? "border-leaf bg-leaf/15 text-leaf cursor-default"
                  : "border-marigold/40 bg-marigold/10 text-marigold hover:bg-marigold/20"
              }`}>
              {vibeStatus === "ready" ? <CheckCircle2 size={14} />
                : vibeStatus === "downloading" ? <Loader2 size={14} className="animate-spin" />
                : <HardDriveDownload size={14} />}
              {vibeStatus === "ready" ? "VibeThinker Ready"
                : vibeStatus === "downloading" ? `Downloading… ${vibeProgress}%`
                : "Download VibeThinker-3B (1.93 GB)"}
            </button>
          </div>
          {vibeStatus === "downloading" && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-board3">
              <div className="h-full bg-marigold transition-all duration-300" style={{ width: `${vibeProgress}%` }} />
            </div>
          )}
          {vibeError && <div className="text-xs text-terracotta">{vibeError}</div>}
        </Card>
      </section>

      {/* Start today's lesson */}
      <div className="bg-[#1a2e24] p-6 rounded-lg flex items-center justify-between border border-leaf/20 cursor-pointer hover:border-leaf/40">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><BookDown /> Start today's lesson</h3>
          <p className="text-chalkdim text-sm">Pick any maths topic or upload a textbook page</p>
        </div>
        <div className="text-white">→</div>
      </div>
    </div>
  );
}
