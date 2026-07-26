import { Button, Card } from "@/components/ui";

export default function VerifyOtpPage() {
  return (
    <Card>
      <div className="mb-4 font-display text-xl text-chalk">Enter the code</div>
      <p className="mb-4 text-sm text-chalkdim">We sent a 6-digit code to your phone.</p>
      <form className="flex flex-col gap-3">
        <input
          className="rounded-lg border border-board3 bg-board px-3.5 py-2.5 text-center text-lg tracking-[0.5em] text-chalk"
          placeholder="••••••"
          maxLength={6}
        />
        {/* TODO: verify against /api/auth/verify-otp, then set gg_session cookie and redirect via ROLE_HOME */}
        <Button type="submit">Verify</Button>
      </form>
    </Card>
  );
}
