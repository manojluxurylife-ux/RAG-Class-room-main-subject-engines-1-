import { Button, Card } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-marigold">
        AI Maths Teacher for Indian Schools
      </div>
      <h1 className="mt-2 font-display text-5xl leading-tight text-chalk">AI Guru</h1>
      <p className="mt-4 max-w-prose text-chalkdim">
        One teacher, every mother tongue. Malayalam, Tamil, Kannada, Hindi, Telugu, or English —
        aligned to CBSE, Kerala, Tamil Nadu, and Karnataka syllabi.
      </p>
      <div className="mt-6 flex gap-3">
        <Button href="/signup">Get started</Button>
        <Button href="/pricing" variant="ghost">
          See pricing
        </Button>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="font-display text-lg text-marigold">Your language</div>
          <p className="mt-1 text-sm text-chalkdim">
            Lessons taught in the student&apos;s mother tongue, not just translated.
          </p>
        </Card>
        <Card>
          <div className="font-display text-lg text-marigold">Your syllabus</div>
          <p className="mt-1 text-sm text-chalkdim">
            CBSE/NCERT or state board — pitched to the right class level.
          </p>
        </Card>
        <Card>
          <div className="font-display text-lg text-marigold">For parents & schools</div>
          <p className="mt-1 text-sm text-chalkdim">
            Track real progress, not just screen time.
          </p>
        </Card>
      </div>
    </div>
  );
}
