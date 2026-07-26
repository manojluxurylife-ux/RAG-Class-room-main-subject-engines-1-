import { Button, Card, PageHeader } from "@/components/ui";

export default function SchoolTeachersPage() {
  return (
    <div>
      <PageHeader eyebrow="Staff" title="Teacher accounts" />
      <Card className="mb-4">
        {/* TODO: invite/manage teacher accounts, each scoped to specific classes */}
        <p className="mb-3 text-sm text-chalkdim">No teacher accounts added yet.</p>
        <Button variant="ghost">+ Invite teacher</Button>
      </Card>
    </div>
  );
}
