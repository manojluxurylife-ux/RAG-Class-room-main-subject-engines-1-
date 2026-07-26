import { Button, Card, PageHeader } from "@/components/ui";

export default function SchoolBillingPage() {
  return (
    <div>
      <PageHeader eyebrow="Billing" title="Seats & invoices" />
      <Card className="mb-4">
        <div className="font-display text-lg text-chalk">200 seats — annual plan</div>
        <div className="text-xs text-chalkdim">Renews 1 Apr 2027 · GST invoice on file</div>
        {/* TODO: Razorpay bulk-seat billing + GST-compliant invoicing */}
        <div className="mt-3">
          <Button variant="ghost">Manage seats</Button>
        </div>
      </Card>
    </div>
  );
}
