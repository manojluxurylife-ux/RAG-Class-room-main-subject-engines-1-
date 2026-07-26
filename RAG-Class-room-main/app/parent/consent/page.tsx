import { Button, Card, PageHeader } from "@/components/ui";

export default function ParentConsentPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Required"
        title="Parental consent"
        subtitle="Required under India's DPDP Act before any child profile can be activated."
      />
      <Card>
        {/* TODO: real consent text reviewed by counsel + signature/checkbox capture + timestamp logged */}
        <p className="mb-4 text-sm text-chalkdim">
          I confirm I am this child&apos;s parent or legal guardian and consent to AI Guru
          processing their learning data as described in the Privacy Policy.
        </p>
        <Button>I consent</Button>
      </Card>
    </div>
  );
}
