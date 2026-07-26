"use client";
/**
 * A colourful, expandable "what to do / how to do it" guide for
 * students new to the app — Dashboard's actual content now, replacing
 * the placeholder from the previous session.
 *
 * Every claim in here was verified against the real, current code
 * this session — the 11 material types, the exact create-all-at-once
 * flow, the paragraph-by-paragraph teaching + whiteboard spotlight
 * behaviour, which material cards open as real interactive viewers
 * versus notes, and how chapter tests reach the Parent Portal — not
 * written from a generic template.
 *
 * Each step uses one of this app's own accent colours (leaf, marigold,
 * indigo, sky, terracotta) so the five stages are visually distinct at
 * a glance, matching colour-coding already used elsewhere in the app
 * (e.g. RAG Classroom's own indigo/sky/amber panels) rather than
 * inventing a new palette.
 */
import { useState } from "react";
import Link from "next/link";
import {
  Settings, Sparkles, BookOpen, LayoutGrid, GraduationCap,
  ChevronDown, ArrowRight, Zap, HardDriveDownload, BookDown,
  Upload, Layers3, HardDrive, Play, Volume2, Lightbulb, Camera,
  FileText, Presentation, HelpCircle, ClipboardCheck, Users,
} from "lucide-react";
import { Card } from "@/components/ui";

interface Step {
  id: string;
  color: "leaf" | "marigold" | "indigo" | "sky" | "terracotta";
  icon: React.ElementType;
  title: string;
  summary: string;
  actionLabel: string;
  actionHref: string;
  points: { icon: React.ElementType; text: string }[];
}

const STEPS: Step[] = [
  {
    id: "settings",
    color: "leaf",
    icon: Settings,
    title: "1. Set up once in Settings",
    summary: "Connect your free AI key, and optionally an offline backup and your textbook.",
    actionLabel: "Go to Settings",
    actionHref: "/settings",
    points: [
      { icon: Zap, text: "Activate Brain1 — your own free Gemini key. Takes about 2 minutes, no card needed; the page walks you through copying it and pastes it in for you." },
      { icon: HardDriveDownload, text: "Optional: download the Local Brain (about 550 MB) so classes still work with zero internet — a genuine backup, not required to get started." },
      { icon: BookDown, text: "Optional: search for your official textbook PDF right from this page, using your own key." },
    ],
  },
  {
    id: "materials",
    color: "marigold",
    icon: Sparkles,
    title: "2. Create study materials in Material Studio",
    summary: "Upload a textbook PDF once — all 11 study materials are created together.",
    actionLabel: "Go to Material Studio",
    actionHref: "/material-studio",
    points: [
      { icon: Upload, text: "Upload a PDF, fill in the subject, class, syllabus, and language once." },
      { icon: Layers3, text: "Press \"Create Study Materials\" — all 11 material types (Notes, PPT, Flashcards, MCQ Quiz, Worksheet, Mind Map, Interactive Book, Revision Notes, and the lesson content behind the classroom itself) are generated at the same time, not one by one." },
      { icon: HardDrive, text: "If your device runs low on storage mid-way, materials are automatically backed up to your own Google Drive instead, with your permission — nothing just fails." },
      { icon: BookOpen, text: "Working on a second textbook? Use \"Add Another PDF\" — your first one and everything made from it stays right where it is." },
    ],
  },
  {
    id: "classroom",
    color: "indigo",
    icon: BookOpen,
    title: "3. Start a class in RAG Classroom",
    summary: "Pick your textbook and press Start — the AI teaches it to you, page by page.",
    actionLabel: "Go to RAG Classroom",
    actionHref: "/rag-classroom",
    points: [
      { icon: Play, text: "Choose your textbook, then press \"Start Class.\"" },
      { icon: Volume2, text: "Each paragraph is read aloud in the textbook's own language first, then explained in your chosen teaching language — one paragraph at a time, not the whole page at once." },
      { icon: Lightbulb, text: "The whiteboard writes out the explanation as it's spoken, and a soft spotlight highlights exactly that paragraph on the textbook page itself, so it feels like a real class, not a recording." },
      { icon: Camera, text: "Got a doubt? Press \"Pause\" — it stops right there without losing your place — then ask by camera or voice, even holding up your own notebook to check a solved problem." },
    ],
  },
  {
    id: "study-materials",
    color: "sky",
    icon: LayoutGrid,
    title: "4. Use your 11 study materials",
    summary: "Every material you made appears as a card at the bottom of RAG Classroom.",
    actionLabel: "Open RAG Classroom",
    actionHref: "/rag-classroom",
    points: [
      { icon: Presentation, text: "PPT and MCQ Quiz (and Flashcards) open as the real thing — an actual slide deck you click through, and a quiz where you pick an answer and find out if you got it right — not just plain text." },
      { icon: FileText, text: "Notes, Worksheet, Mind Map, Interactive Book, and Revision Notes open as clear, readable notes for that chapter." },
      { icon: HelpCircle, text: "Stuck on anything inside a material? Ask AI Guru about it directly from the same screen — by camera and mic, or by highlighting the text." },
    ],
  },
  {
    id: "exam",
    color: "terracotta",
    icon: GraduationCap,
    title: "5. Chapter tests and results",
    summary: "A short test appears automatically at the end of each chapter — and your parent sees the result.",
    actionLabel: "See Progress",
    actionHref: "/progress",
    points: [
      { icon: ClipboardCheck, text: "Finish a chapter in class, and a 5-question test pops up on its own — no need to go looking for it." },
      { icon: Zap, text: "It's scored instantly, right there, with no internet needed for the grading itself." },
      { icon: Users, text: "The result is saved automatically and shows up in both your own Progress page and your parent's Parent Portal — so they see real progress, not just a promise." },
    ],
  },
];

const COLOR_CLASSES: Record<Step["color"], { border: string; bg: string; text: string; iconBg: string }> = {
  leaf:       { border: "border-leaf/40",       bg: "bg-leaf/10",       text: "text-leaf",       iconBg: "bg-leaf/20" },
  marigold:   { border: "border-marigold/40",   bg: "bg-marigold/10",   text: "text-marigold",   iconBg: "bg-marigold/20" },
  indigo:     { border: "border-indigo-400/40", bg: "bg-indigo-500/10", text: "text-indigo-300", iconBg: "bg-indigo-500/20" },
  sky:        { border: "border-sky-400/40",    bg: "bg-sky-500/10",   text: "text-sky-300",    iconBg: "bg-sky-500/20" },
  terracotta: { border: "border-terracotta/40", bg: "bg-terracotta/10", text: "text-terracotta", iconBg: "bg-terracotta/20" },
};

export function GettingStartedGuide() {
  const [openId, setOpenId] = useState<string | null>("settings");

  return (
    <div className="flex flex-col gap-3">
      {STEPS.map(step => {
        const open = openId === step.id;
        const c = COLOR_CLASSES[step.color];
        const StepIcon = step.icon;
        return (
          <Card key={step.id} className={`overflow-hidden p-0 ${open ? c.border : ""}`}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : step.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.iconBg}`}>
                <StepIcon size={19} className={c.text} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base text-chalk">{step.title}</div>
                <div className="mt-0.5 text-xs text-chalkdim">{step.summary}</div>
              </div>
              <ChevronDown size={18} className={`shrink-0 text-chalkdim transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className={`border-t ${c.border} ${c.bg} px-4 py-4`}>
                <ul className="mb-3 flex flex-col gap-2.5">
                  {step.points.map((point, i) => {
                    const PointIcon = point.icon;
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-chalk leading-relaxed">
                        <PointIcon size={15} className={`mt-0.5 shrink-0 ${c.text}`} />
                        <span>{point.text}</span>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href={step.actionHref}
                  className={`inline-flex items-center gap-1.5 rounded-lg border ${c.border} ${c.bg} px-3.5 py-2 font-mono text-[11px] font-semibold ${c.text} hover:brightness-110`}
                >
                  {step.actionLabel} <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
