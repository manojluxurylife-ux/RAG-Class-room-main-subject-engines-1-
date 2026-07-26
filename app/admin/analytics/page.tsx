import { EmptyState, PageHeader } from "@/components/ui";

export default function AdminAnalyticsPage() {
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Analytics" />
      {/* TODO: usage trends, language/board distribution, retention */}
      <EmptyState text="Charts go here once usage events are tracked." />
    </div>
  );
}
