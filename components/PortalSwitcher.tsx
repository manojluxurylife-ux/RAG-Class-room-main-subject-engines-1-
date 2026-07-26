"use client";
/**
 * A persistent, always-visible widget letting a verified admin jump
 * between ANY portal (student/parent/admin/school) from ANY page —
 * "all portals, all pages," without going back to the login screen or
 * retyping the entry key each time.
 *
 * Only renders its actual switch buttons once /api/auth/admin-entry-status
 * confirms this browser already holds a valid proof cookie — that
 * status check is for UI purposes only, not the real security boundary;
 * /api/auth/dev-bypass independently re-verifies the same proof on every
 * actual switch, exactly as it does for the first-time login-page entry.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, X } from "lucide-react";
import { studentSession } from "@/lib/student-session";

const ROLES = ["student", "parent", "admin", "school"] as const;

export function PortalSwitcher() {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/admin-entry-status")
      .then(r => r.json())
      .then(d => setVerified(!!d.verified))
      .catch(() => {});
  }, []);

  async function switchTo(role: typeof ROLES[number]) {
    setSwitching(role);
    try {
      const res = await fetch("/api/auth/dev-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }), // no key needed — the proof cookie already covers this
      });
      const data = await res.json();
      if (!res.ok) return;
      if (role === "student" && data.student) {
        studentSession.save({
          name: data.student.name, email: data.student.email, phone: "",
          className: data.student.className, syllabus: data.student.syllabus,
          schoolName: data.student.schoolName, state: data.student.state,
          district: data.student.district, place: data.student.place,
          languageId: data.student.languageId,
        });
      }
      router.push(data.redirect);
    } finally {
      setSwitching(null);
    }
  }

  if (!verified) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40">
      {open ? (
        <div className="rounded-2xl border border-terracotta/40 bg-board shadow-2xl p-3 w-52">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-terracotta">Switch portal</span>
            <button onClick={() => setOpen(false)} className="text-chalkdim hover:text-terracotta"><X size={12} /></button>
          </div>
          <div className="flex flex-col gap-1.5">
            {ROLES.map(role => (
              <button key={role} onClick={() => switchTo(role)} disabled={switching !== null}
                className="rounded-lg border border-board3 px-3 py-1.5 text-xs capitalize text-chalk hover:border-terracotta/50 disabled:opacity-50 text-left">
                {switching === role ? <Loader2 size={12} className="animate-spin" /> : role}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-board shadow-xl px-3.5 py-2.5 font-mono text-[10px] text-terracotta hover:bg-terracotta/10 transition-colors">
          <Shield size={13} /> Admin
        </button>
      )}
    </div>
  );
}
