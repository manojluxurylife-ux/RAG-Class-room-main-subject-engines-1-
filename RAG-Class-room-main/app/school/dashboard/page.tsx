import { PageHeader, StatCard, Card } from "@/components/ui";

export default function SchoolDashboard() {
  return (
    <div>
      <PageHeader eyebrow="School" title="Overview" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active classes" value="6" />
        <StatCard label="Licensed seats" value="180 / 200" />
        <StatCard label="Avg. weekly usage" value="3.2 lessons" />
      </div>
      <Card className="mt-4">
        <p className="text-sm text-chalkdim">
          {/* TODO: recent activity feed across classes */}
          Recent activity across classes will appear here.
        </p>
      </Card>
    </div>
  );
}
