import { ReactNode } from "react";
import { PortalShell } from "@/components/PortalShell";
import { getSession } from "@/lib/auth";

export default async function SchoolLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <PortalShell role="school" userName={session?.name}>
      {children}
    </PortalShell>
  );
}
