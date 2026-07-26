import { ReactNode } from "react";
import { PortalShell } from "@/components/PortalShell";
import { getSession } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <PortalShell role="admin" userName={session?.name}>
      {children}
    </PortalShell>
  );
}
