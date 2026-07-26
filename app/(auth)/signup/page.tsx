import { Card } from "@/components/ui";
import Link from "next/link";

export default function SignupPage() {
  return (
    <Card>
      <div className="mb-4 font-display text-xl text-chalk">Create an account</div>
      <p className="mb-4 text-sm text-chalkdim">Who are you signing up as?</p>
      <div className="flex flex-col gap-3">
        <Link
          href="/signup/student"
          className="rounded-lg border border-board3 bg-board px-4 py-3 text-sm text-chalk hover:border-marigold"
        >
          I&apos;m a student
        </Link>
        <Link
          href="/signup/parent"
          className="rounded-lg border border-board3 bg-board px-4 py-3 text-sm text-chalk hover:border-marigold"
        >
          I&apos;m a parent
        </Link>
        <Link
          href="/signup/school"
          className="rounded-lg border border-board3 bg-board px-4 py-3 text-sm text-chalk hover:border-marigold"
        >
          I&apos;m signing up a school
        </Link>
      </div>
      {/* TODO: build /signup/parent and /signup/school forms; both should end at /verify-otp.
          /signup/student is built — see app/(auth)/signup/student/page.tsx */}
    </Card>
  );
}
