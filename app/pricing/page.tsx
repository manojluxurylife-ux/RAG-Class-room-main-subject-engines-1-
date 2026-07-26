import { Button, Card, PageHeader } from "@/components/ui";

const PLANS = [
  { name: "Family", price: "₹299/mo", blurb: "Up to 2 children, all languages & boards.", cta: "/signup" },
  { name: "School", price: "Contact us", blurb: "Per-seat licensing for classrooms.", cta: "/contact" },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <PageHeader eyebrow="Pricing" title="Simple, transparent pricing" />
      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((p) => (
          <Card key={p.name}>
            <div className="font-display text-xl text-chalk">{p.name}</div>
            <div className="mt-1 text-2xl text-marigold">{p.price}</div>
            <p className="mt-2 text-sm text-chalkdim">{p.blurb}</p>
            <div className="mt-4">
              <Button href={p.cta}>{p.name === "School" ? "Talk to us" : "Start free trial"}</Button>
            </div>
          </Card>
        ))}
      </div>
      {/* TODO: wire to Razorpay checkout — see lib/billing.ts (not yet built) */}
    </div>
  );
}
