"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Card } from "@/components/ui";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

const LANGUAGES = SUPPORTED_LANGUAGES.map(l => ({ id: l.id, label: l.nativeLabel }));

const BOARDS = [
  { id: "cbse", label: "CBSE (NCERT)" },
  { id: "kerala", label: "Kerala State Syllabus" },
  { id: "tamilnadu", label: "Tamil Nadu State Board" },
  { id: "karnataka", label: "Karnataka State Board" },
];
const GRADES = ["6", "7", "8", "9", "10"];

// This is the same profile capture proven out in the standalone demo,
// now as the first real step after a parent adds a child.
export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [board, setBoard] = useState("");
  const [grade, setGrade] = useState("");
  const canContinue = language && board && grade;

  async function handleContinue() {
    // TODO: POST to /api/children to create the child profile, then redirect.
    router.push("/classroom");
  }

  return (
    <Card className="max-w-lg">
      <div className="mb-1 font-display text-xl text-chalk">Set up this child&apos;s class</div>
      <p className="mb-5 text-sm text-chalkdim">This decides the language and level AI Guru teaches in.</p>

      <input
        className="mb-5 w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
        placeholder="Child's name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-chalkdim">Mother tongue</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {LANGUAGES.map((l) => (
          <Chip key={l.id} active={language === l.id} onClick={() => setLanguage(l.id)}>
            {l.label}
          </Chip>
        ))}
      </div>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-chalkdim">Syllabus / Board</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {BOARDS.map((b) => (
          <Chip key={b.id} active={board === b.id} onClick={() => setBoard(b.id)}>
            {b.label}
          </Chip>
        ))}
      </div>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-chalkdim">Class</div>
      <div className="mb-6 flex flex-wrap gap-2">
        {GRADES.map((g) => (
          <Chip key={g} active={grade === g} onClick={() => setGrade(g)}>
            Class {g}
          </Chip>
        ))}
      </div>

      <Button disabled={!canContinue} onClick={handleContinue}>
        Continue to classroom
      </Button>
    </Card>
  );
}
