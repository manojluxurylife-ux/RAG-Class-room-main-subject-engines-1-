import { Button, Card, PageHeader } from "@/components/ui";

export default function ParentBillingPage() {
  return (
    <div>
      <PageHeader eyebrow="Billing" title="Subscription" />
      <Card className="mb-4">
        <div className="font-display text-lg text-chalk">Family plan — ₹299/mo</div>
        <div className="text-xs text-chalkdim">Next billing date: 1 Jul 2026</div>
        {/* TODO: wire to Razorpay subscription management + webhook handling, mirroring Nexus Justice's pattern */}
        <div className="mt-3">
          <Button variant="ghost">Manage subscription</Button>
        </div>
      </Card>
      <div className="mb-2 font-display text-base text-chalk">Invoices</div>
      <Card>
        <p className="text-sm text-chalkdim">No invoices yet.</p>
      </Card>
    </div>
  );
}
