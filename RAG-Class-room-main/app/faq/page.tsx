import { PageHeader } from "@/components/ui";

const FAQS = [
  { q: "Which languages are supported?", a: "English, Malayalam, Tamil, Kannada, Hindi, and Telugu, with more planned." },
  { q: "Which boards are covered?", a: "CBSE (NCERT), Kerala State Syllabus, Tamil Nadu State Board, and Karnataka State Board." },
  { q: "Does my child need their own login?", a: "No — children access lessons through a parent or school account, never an independent login." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <PageHeader eyebrow="Help" title="Frequently asked questions" />
      <div className="flex flex-col gap-4">
        {FAQS.map((f) => (
          <div key={f.q} className="border-b border-board3 pb-4">
            <div className="font-semibold text-chalk">{f.q}</div>
            <p className="mt-1 text-sm text-chalkdim">{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
