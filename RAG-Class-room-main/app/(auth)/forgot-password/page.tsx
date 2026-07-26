"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Mode = "email" | "phone";

export default function ForgotPasswordPage() {
  const [mode, setMode]   = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [sent, setSent]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!value.trim()) { setError("This field is required."); return; }

    setSubmitting(true);
    try {
      // TODO: replace with real endpoints —
      //   email mode (students): POST /api/auth/forgot-password { email } → reset link
      //   phone mode (parent/school): POST /api/auth/send-otp { phone } → OTP, then /verify-otp
      await new Promise(res => setTimeout(res, 500));
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[540px] bg-[#16281F] rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45),0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden border border-[#24402F]">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1E3527] to-[#17291F] p-7 border-b-2 border-dashed border-[#F2A93B66]">
        <h1 className="font-display font-extrabold text-3xl text-[#FDF6EC] leading-tight">
          Reset access 🔐
        </h1>
        <p className="text-sm font-semibold text-[#A9C2AE] mt-2">
          {mode === "email"
            ? "Students sign in with a password — enter your email and we'll send a reset link."
            : "Parents and schools sign in with phone OTP — enter your number and we'll send a fresh code."}
        </p>
      </div>

      <div className="p-8">
        
        {/* Mode toggle */}
        <div className="flex w-full gap-2 rounded-xl bg-[#0F1F16] p-1 mb-6 border border-[#24402F]">
          <button type="button" onClick={() => { setMode("email"); setSent(false); setValue(""); }}
            className={`flex-1 rounded-lg py-2.5 font-display font-bold text-sm transition-colors ${
              mode === "email" ? "bg-[#F2A93B] text-[#16281F]" : "text-[#6E8C77] hover:text-[#FDF6EC]"
            }`}>
            Student (email)
          </button>
          <button type="button" onClick={() => { setMode("phone"); setSent(false); setValue(""); }}
            className={`flex-1 rounded-lg py-2.5 font-display font-bold text-sm transition-colors ${
              mode === "phone" ? "bg-[#F2A93B] text-[#16281F]" : "text-[#6E8C77] hover:text-[#FDF6EC]"
            }`}>
            Parent/School (phone)
          </button>
        </div>

        {sent ? (
          <div className="rounded-[14px] border border-[#24402F] bg-[#0F1F16] p-5 text-sm font-bold text-[#A9C2AE]">
            {mode === "email"
              ? <>A password reset link has been sent to <span className="text-[#FDF6EC]">{value}</span>. Check your inbox.</>
              : <>A verification code has been sent to <span className="text-[#FDF6EC]">{value}</span>.</>}
            {mode === "phone" && (
              <div className="mt-4">
                <Link href="/verify-otp" className="text-[#F2A93B] font-display font-bold hover:underline">Enter code →</Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input
              type={mode === "email" ? "email" : "tel"}
              className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
              placeholder={mode === "email" ? "you@example.com" : "Phone number"}
              value={value}
              onChange={e => setValue(e.target.value)}
            />
            {error && <div className="text-xs font-bold text-[#FF9B7A]">{error}</div>}
            <button type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-[#F2A93B] to-[#E8934A] py-4 text-lg font-extrabold text-[#14251A] shadow-[0_10px_24px_rgba(242,169,59,0.35)] hover:opacity-90 disabled:opacity-50 transition-all">
              {submitting
                ? <><Loader2 size={20} className="animate-spin" /> Sending…</>
                : mode === "email" ? "Send reset link" : "Send OTP"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs font-bold text-[#6E8C77]">
          <Link href="/login" className="text-[#F2A93B] hover:underline">← Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
