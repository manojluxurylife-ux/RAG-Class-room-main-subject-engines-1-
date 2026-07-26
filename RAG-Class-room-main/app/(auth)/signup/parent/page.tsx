"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";

export default function ParentSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Please fill in every field."); return;
    }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed."); return; }
      router.push("/parent/children/add");
    } catch {
      setError("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-1 font-display text-xl text-chalk">Create a parent account</div>
      <p className="mb-4 text-sm text-chalkdim">See your child's real learning progress — quiz results, topics covered, and where they might need help.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalkdim">Your name</label>
          <input className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalkdim">Email</label>
          <input type="email" autoComplete="email" className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalkdim">Phone</label>
          <input type="tel" className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalkdim">Password</label>
          <div className="relative">
            <input type={showPw ? "text" : "password"} autoComplete="new-password"
              className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 pr-10 text-sm text-chalk"
              value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-chalkdim hover:text-chalk">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalkdim">Confirm password</label>
          <input type={showPw ? "text" : "password"} className="w-full rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-sm text-chalk"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>

        {error && <div className="text-xs text-terracotta">{error}</div>}

        <button type="submit" disabled={loading}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim disabled:opacity-50 transition-colors">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Creating account…</> : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-chalkdim">
        Already have an account? <Link href="/login" className="text-marigold">Log in</Link>
      </p>
    </Card>
  );
}
