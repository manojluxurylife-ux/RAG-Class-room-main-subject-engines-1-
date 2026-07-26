"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { studentSession } from "@/lib/student-session";
import { restoreStudentSession } from "@/lib/client/restore-student-session";
import { DEV_BYPASS_LOGIN } from "@/lib/dev-mode";

type Mode = "student" | "parent" | "admin";

// Remembers the last email typed into this form (student mode only —
// the common, mostly-passwordless path) so a student who does end up
// back here for a genuine re-login isn't starting from a blank field.
// Not sensitive on its own (no password/session data), just a
// convenience.
const REMEMBERED_EMAIL_KEY = "gg_remembered_student_email";

export default function LoginPage() {
  const router  = useRouter();
  const [mode,     setMode]     = useState<Mode>("student");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [bypassLoading, setBypassLoading] = useState<string | null>(null);
  const [entryKey, setEntryKey] = useState("");
  // While this is true the form is hidden — avoids a flash of the login
  // form for a student who's about to be bounced straight past it.
  const [checkingExistingSession, setCheckingExistingSession] = useState(true);

  // A student landing on /login while already validly signed in
  // (localStorage profile, OR the long-lived server cookie even if
  // localStorage was lost — see restoreStudentSession) shouldn't have
  // to log in again at all. This is the other half of "always keep the
  // student inside the app": if they somehow end up back on this page
  // (a bookmark, a stale link, a background tab reload), send them
  // straight back in instead of making them re-enter anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextParam = new URLSearchParams(window.location.search).get("next");
      const profile = await restoreStudentSession();
      if (cancelled) return;
      if (profile) {
        router.replace(nextParam || "/dashboard");
        return;
      }
      const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (remembered) setEmail(remembered);
      setCheckingExistingSession(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function devBypass(role: "student" | "parent" | "admin" | "school") {
    setBypassLoading(role); setError("");
    try {
      const res = await fetch("/api/auth/dev-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, key: entryKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Bypass failed."); return; }
      if (role === "student" && data.student) {
        studentSession.save({
          name: data.student.name, email: data.student.email, phone: "",
          className: data.student.className, syllabus: data.student.syllabus,
          schoolName: data.student.schoolName, state: data.student.state,
          district: data.student.district, place: data.student.place,
          languageId: data.student.languageId,
        });
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, data.student.email);
      }
      router.push(data.redirect);
    } catch {
      setError("Bypass failed.");
    } finally {
      setBypassLoading(null);
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");

    if (mode === "student" || mode === "admin" || mode === "parent") {
      if (!email.trim()) { setError("Enter your email."); return; }
      if (mode !== "student" && !password) { setError("Enter your password."); return; }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Login failed."); return; }

        // Student login also keeps the client-side session (used by the
        // classroom, materials, BYOK key, lesson history, etc.) in sync
        // with the server record that was just verified.
        if (mode === "student" && data.student) {
          studentSession.save({
            name:       data.student.name,
            email:      data.student.email,
            phone:      "",
            className:  data.student.className,
            syllabus:   data.student.syllabus,
            schoolName: data.student.schoolName,
            state:      data.student.state,
            district:   data.student.district,
            place:      data.student.place,
            languageId: data.student.languageId,
          });
          window.localStorage.setItem(REMEMBERED_EMAIL_KEY, data.student.email);
        }

        router.push(data.redirect || (mode === "admin" ? "/admin/dashboard" : mode === "parent" ? "/parent/dashboard" : "/dashboard"));
      } catch {
        setError("Login failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  }

  if (checkingExistingSession) {
    return (
      <div className="w-full max-w-[540px] bg-[#16281F] rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45),0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden border border-[#24402F] p-10 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#F2A93B]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[540px] bg-[#16281F] rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45),0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden border border-[#24402F]">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1E3527] to-[#17291F] p-7 border-b-2 border-dashed border-[#F2A93B66]">
        <h1 className="font-display font-extrabold text-3xl text-[#FDF6EC] leading-tight">
          Welcome back, genius! <span className="text-[#F2A93B]">🌟</span>
        </h1>
        <p className="text-sm font-semibold text-[#A9C2AE] mt-2">Log in to continue your learning journey.</p>
      </div>

      <div className="p-8">
        
        {/* Mode Toggle */}
        <div className="flex w-full gap-2 rounded-xl bg-[#0F1F16] p-1 mb-6 border border-[#24402F]">
          {(["student", "parent", "admin"] as const).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 rounded-lg py-2.5 font-display font-bold text-sm transition-colors ${
                mode === m ? "bg-[#F2A93B] text-[#16281F]" : "text-[#6E8C77] hover:text-[#FDF6EC]"
              }`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Email</label>
            <input type="email" autoComplete="email"
              className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
              placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {mode !== "student" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest">Password</label>
                <Link href="/forgot-password" className="text-xs font-bold text-[#6E8C77] hover:text-[#F2A93B]">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input type={showPw ? "text" : "password"} autoComplete="current-password"
                  className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 pr-12 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
                  placeholder="Your password"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6E8C77] hover:text-[#FDF6EC]">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && <div className="text-xs font-bold text-[#FF9B7A]">{error}</div>}

          <button type="submit" disabled={loading}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-[#F2A93B] to-[#E8934A] py-4 text-lg font-extrabold text-[#14251A] shadow-[0_10px_24px_rgba(242,169,59,0.35)] hover:opacity-90 disabled:opacity-50 transition-all">
            {loading ? <><Loader2 size={20} className="animate-spin" /> Signing in…</> : "Let's Go! 🚀"}
          </button>
        </form>

        {/* Signup Link */}
        {mode === "student" && (
          <p className="mt-6 text-center text-xs font-bold text-[#6E8C77]">
            New here? <Link href="/signup/student" className="text-[#F2A93B] hover:underline">Create a student account</Link>
          </p>
        )}
        {mode === "parent" && (
          <p className="mt-6 text-center text-xs font-bold text-[#6E8C77]">
            New here? <Link href="/signup/parent" className="text-[#F2A93B] hover:underline">Create a parent account</Link>
          </p>
        )}
      </div>
    </div>
  );
}
