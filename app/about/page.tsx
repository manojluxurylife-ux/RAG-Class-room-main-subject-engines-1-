import { PageHeader } from "@/components/ui";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <PageHeader title="About AI Guru" />
      <p className="text-sm text-chalkdim">
        AI Guru is an AI maths teacher built for Indian schools — teaching every student in
        their own mother tongue, aligned to their own syllabus. {/* TODO: real copy */}
      </p>
    </div>
  );
}
