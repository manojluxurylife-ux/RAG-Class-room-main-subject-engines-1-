"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <button onClick={handleLogout}
      className="inline-flex items-center gap-1 font-mono text-[11px] text-chalkdim hover:text-terracotta">
      <LogOut size={11} /> Log out
    </button>
  );
}
