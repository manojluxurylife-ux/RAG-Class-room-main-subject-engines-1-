"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SKIP_VERIFICATION } from "@/lib/dev-mode";
import { studentSession } from "@/lib/student-session";
import { INDIA_STATES, districtsOf } from "@/lib/india-districts";

const COUNTRIES = ["India"];
const CLASSES   = ["V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const BOARDS    = [
  { id: "cbse",      label: "CBSE" },
  { id: "kerala",    label: "Kerala State" },
  { id: "tamilnadu", label: "Tamil Nadu" },
  { id: "karnataka", label: "Karnataka" },
];

interface FormState {
  name: string; email: string; phone: string;
  className: string; syllabus: string; schoolName: string;
  country: string; state: string; district: string;
}

const EMPTY: FormState = {
  name: "", email: "", phone: "",
  className: "", syllabus: "", schoolName: "",
  country: "India", state: "", district: "",
};

export default function StudentSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())        e.name = "Required";
    if (!form.email.trim())       e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.phone.trim())       e.phone = "Required";
    else if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) e.phone = "Enter a 10-digit number";
    if (!form.schoolName.trim())  e.schoolName = "Required";
    if (!form.className)          e.className = "Required";
    if (!form.syllabus)           e.syllabus = "Required";
    if (!form.country)            e.country = "Required";
    if (!form.state)              e.state = "Required";
    if (!form.district)           e.district = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone,
          className: form.className, syllabus: form.syllabus, schoolName: form.schoolName,
          country: form.country, state: form.state, district: form.district,
          place: form.district,
          languageId: "english",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Signup failed."); setSubmitting(false); return; }

      if (SKIP_VERIFICATION) {
        studentSession.save({
          name:       form.name,
          email:      form.email,
          phone:      form.phone,
          className:  form.className,
          syllabus:   form.syllabus,
          schoolName: form.schoolName,
          state:      form.state,
          district:   form.district,
          place:      form.district,
          languageId: "english",
        });
        router.push("/dashboard");
      } else {
        router.push("/verify-otp?next=/dashboard");
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const districts = districtsOf(form.state);

  return (
    <div className="w-full max-w-[540px] bg-[#16281F] rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45),0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden border border-[#24402F]">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1E3527] to-[#17291F] p-7 border-b-2 border-dashed border-[#F2A93B66]">
        <h1 className="font-display font-extrabold text-3xl text-[#FDF6EC] leading-tight">
          Join the classroom 🎒
        </h1>
        <p className="text-sm font-semibold text-[#A9C2AE] mt-2">Your own AI teacher — for your class, your syllabus, your language.</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {/* About you */}
          <div>
            <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Full Name</label>
            <input className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
              placeholder="e.g. Anjali Nair" autoComplete="name"
              value={form.name} onChange={e => update("name", e.target.value)} />
            {errors.name && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.name}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Phone</label>
              <input type="tel" className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
                placeholder="10-digit mobile" autoComplete="tel"
                value={form.phone} onChange={e => update("phone", e.target.value)} />
              {errors.phone && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.phone}</div>}
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
                placeholder="you@example.com" autoComplete="email"
                value={form.email} onChange={e => update("email", e.target.value)} />
              {errors.email && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.email}</div>}
            </div>
          </div>

          {/* School & class */}
          <div>
            <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">School Name</label>
            <input className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#6E8C77] focus:outline-none focus:border-[#F2A93B]"
              placeholder="e.g. St. Antony's HSS"
              value={form.schoolName} onChange={e => update("schoolName", e.target.value)} />
            {errors.schoolName && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.schoolName}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Class</label>
              <select className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#FDF6EC] focus:outline-none focus:border-[#F2A93B]"
                value={form.className} onChange={e => update("className", e.target.value)}>
                <option value="">Select</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
              {errors.className && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.className}</div>}
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Board</label>
              <select className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#FDF6EC] focus:outline-none focus:border-[#F2A93B]"
                value={form.syllabus} onChange={e => update("syllabus", e.target.value)}>
                <option value="">Select</option>
                {BOARDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              {errors.syllabus && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.syllabus}</div>}
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">Country</label>
              <select className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#FDF6EC] focus:outline-none focus:border-[#F2A93B]"
                value={form.country} onChange={e => update("country", e.target.value)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">State</label>
              <select className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#FDF6EC] focus:outline-none focus:border-[#F2A93B]"
                value={form.state} onChange={e => { update("state", e.target.value); update("district", ""); }}>
                <option value="">Select state</option>
                {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.state}</div>}
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#F2A93B] uppercase tracking-widest mb-1.5">District</label>
              <select className="w-full rounded-[14px] border-2 border-[#2A4936] bg-[#0F1F16] px-4 py-3 text-sm font-bold text-[#FDF6EC] focus:outline-none focus:border-[#F2A93B]"
                value={form.district} onChange={e => update("district", e.target.value)} disabled={!districts.length}>
                <option value="">{districts.length ? "Select" : "Select state"}</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {errors.district && <div className="text-xs font-bold text-[#FF9B7A] mt-1">{errors.district}</div>}
            </div>
          </div>

          {submitError && <div className="text-xs font-bold text-[#FF9B7A]">{submitError}</div>}

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-[#F2A93B] to-[#E8934A] py-4 text-lg font-extrabold text-[#14251A] shadow-[0_10px_24px_rgba(242,169,59,0.35)] hover:opacity-90 disabled:opacity-50 transition-all">
            {submitting ? <><Loader2 size={20} className="animate-spin" /> Entering…</> : "Let's Go! 🚀"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-bold text-[#6E8C77]">
          Already have an account? <Link href="/login" className="text-[#F2A93B] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

