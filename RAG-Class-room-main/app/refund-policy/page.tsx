import { PageHeader } from "@/components/ui";

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <PageHeader title="Refund Policy" />
      <p className="text-sm text-chalkdim">
        {/* TODO: real legal copy — have this reviewed by counsel before launch,
            especially the children's-data sections required under India's DPDP Act. */}
        Placeholder content for the refund policy page.
      </p>
    </div>
  );
}
