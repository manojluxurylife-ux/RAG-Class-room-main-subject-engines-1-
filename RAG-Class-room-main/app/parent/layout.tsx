import { ReactNode } from "react";
import { PortalShell } from "@/components/PortalShell";
import { getSession } from "@/lib/auth";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <PortalShell role="parent" userName={session?.name}>
      {children}
    </PortalShell>
  );
}
