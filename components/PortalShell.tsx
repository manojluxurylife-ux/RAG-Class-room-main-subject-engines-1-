import Link from "next/link";
import { ReactNode } from "react";
import type { Role } from "@/lib/auth";
import { PORTAL_NAV } from "@/lib/roles";
import { LogoutButton } from "./LogoutButton";
import { DevBypassBanner } from "./DevBypassBanner";
import { PortalSwitcher } from "./PortalSwitcher";

export function PortalShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName?: string;
  children: ReactNode;
}) {
  const links = PORTAL_NAV[role];
  return (
    <>
      <DevBypassBanner />
      <PortalSwitcher />
      <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-4 py-6 md:px-8">
      <aside className="hidden w-52 shrink-0 md:block">
        <Link href="/" className="font-display text-xl text-chalk">
          AI Guru
        </Link>
        <div className="mt-1 mb-6 font-mono text-[10px] uppercase tracking-wider text-marigold">
          {role} portal
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-chalkdim hover:bg-board2 hover:text-chalk"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between md:hidden">
          <Link href="/" className="font-display text-lg text-chalk">
            AI Guru
          </Link>
        </div>
        {userName && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-board3 bg-board2 px-4 py-2.5 text-xs text-chalkdim">
            <span>Signed in as {userName}</span>
            <LogoutButton />
          </div>
        )}
        {children}
      </main>
      </div>
    </>
  );
}
