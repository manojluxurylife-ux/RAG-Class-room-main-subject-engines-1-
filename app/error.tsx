"use client";
import { Button } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="font-display text-5xl text-terracotta">Oops</div>
      <p className="mt-2 mb-6 text-chalkdim">Something went wrong on our end.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
