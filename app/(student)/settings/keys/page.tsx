"use client";
import { GeminiKeyManager } from "@/components/GeminiKeyManager";
import { PageHeader } from "@/components/ui";

export default function KeysPage() {
  return (
    <div className="p-6">
      <PageHeader
        eyebrow="Settings"
        title="Manage Gemini Keys"
        subtitle="Manage your keys for uninterrupted lessons."
      />
      <GeminiKeyManager />
    </div>
  );
}
