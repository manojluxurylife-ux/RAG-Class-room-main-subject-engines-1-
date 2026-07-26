import { Button, PageHeader } from "@/components/ui";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <PageHeader title="Contact us" subtitle="Schools and bulk-licensing enquiries welcome." />
      <form className="flex flex-col gap-3">
        <input className="rounded-lg border border-board3 bg-board2 px-3.5 py-2.5 text-sm text-chalk" placeholder="Name" />
        <input className="rounded-lg border border-board3 bg-board2 px-3.5 py-2.5 text-sm text-chalk" placeholder="Email" />
        <textarea className="rounded-lg border border-board3 bg-board2 px-3.5 py-2.5 text-sm text-chalk" placeholder="Message" rows={4} />
        {/* TODO: wire to a real form handler / email service */}
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
