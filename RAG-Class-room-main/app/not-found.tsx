import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="font-display text-5xl text-marigold">404</div>
      <p className="mt-2 mb-6 text-chalkdim">This page hasn&apos;t been chalked in yet.</p>
      <Button href="/">Back home</Button>
    </div>
  );
}
