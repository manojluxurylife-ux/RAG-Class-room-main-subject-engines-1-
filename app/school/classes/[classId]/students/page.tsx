import { PageHeader, Card } from "@/components/ui";

export default function ClassRosterPage({ params }: { params: { classId: string } }) {
  // TODO: fetch real roster for params.classId
  return (
    <div>
      <PageHeader eyebrow="Roster" title={`Class ${params.classId}`} />
      <Card>
        <p className="text-sm text-chalkdim">Student roster table goes here.</p>
      </Card>
    </div>
  );
}
