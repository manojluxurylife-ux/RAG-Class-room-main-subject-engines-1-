import { Card, PageHeader } from "@/components/ui";

export default function SchoolReportsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Class performance"
        subtitle="Aggregate only — individual student surveillance isn't part of the design."
      />
      <Card>
        {/* TODO: per-class topic mastery breakdown */}
        <p className="text-sm text-chalkdim">Aggregate charts coming soon.</p>
      </Card>
    </div>
  );
}
