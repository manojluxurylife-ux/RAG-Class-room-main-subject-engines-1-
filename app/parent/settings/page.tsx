import { Card, PageHeader } from "@/components/ui";

export default function ParentSettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Account settings" />
      <Card>
        {/* TODO: screen-time limits, notification preferences */}
        <p className="text-sm text-chalkdim">Screen-time limits and notification preferences go here.</p>
      </Card>
    </div>
  );
}
