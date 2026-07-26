"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  BookDown,
  ChevronDown,
  FlaskConical,
  Gauge,
  HardDriveDownload,
  Home,
  KeyRound,
  Library,
  MessageSquare,
  Parentheses,
  Search,
  Settings,
  Sparkles,
  UserRound,
  WifiOff,
} from "lucide-react";
import { NewMaterialsIndicator } from "@/components/NewMaterialsIndicator";

const standardItems = [
  { label: "Material Studio", href: "/material-studio", icon: Sparkles },
  { label: "RAG Classroom", href: "/rag-classroom", icon: BookOpen, accent: true },
  { label: "Offline Library", href: "/offline-library", icon: WifiOff, accent: true },
  { label: "Homework", href: "/homework", icon: BookDown },
  { label: "Practice", href: "/practice", icon: Parentheses },
  { label: "Virtual Lab", href: "/virtual-lab", icon: FlaskConical },
  { label: "Exam Room", href: "/exam-room", icon: Gauge },
  { label: "Library", href: "/materials", icon: Library, indicator: true },
  { label: "Progress", href: "/progress", icon: Gauge },
  { label: "Parent", href: "/parent-corner", icon: UserRound },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Profile", href: "/profile", icon: UserRound },
];

const settingsItems = [
  { label: "Gemini BYOK Keys", href: "/settings#gemini-byok-keys", icon: KeyRound },
  { label: "Local Model Download", href: "/settings#local-model-download", icon: HardDriveDownload },
  { label: "PDF Textbook Download", href: "/settings#pdf-textbook-download", icon: BookDown },
  { label: "Web Search (Gemini)", href: "/settings#web-search-gemini", icon: Search },
];

function itemClass(active: boolean, accent = false) {
  return `inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-mono text-[11px] whitespace-nowrap transition-colors ${
    active
      ? "bg-violet-600/25 text-chalk ring-1 ring-violet-400/40"
      : accent
        ? "text-amber hover:bg-board3 hover:text-chalk"
        : "text-chalkdim hover:bg-board3 hover:text-chalk"
  }`;
}

export function StudentMainNav() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(pathname === "/settings");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname === "/settings") setSettingsOpen(true);
  }, [pathname]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node) && pathname !== "/settings") {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [pathname]);

  return (
    <nav aria-label="Student main navigation" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-board3 bg-board2 p-1">
      <Link href="/dashboard" className={itemClass(pathname === "/dashboard")}>
        <Home size={13} /> Dashboard
      </Link>

      <div ref={wrapperRef} className="relative flex shrink-0 items-stretch">
        <Link href="/settings" className={`${itemClass(pathname === "/settings")} rounded-r-none`}>
          <Settings size={13} /> Settings
        </Link>
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="student-settings-submenu"
          aria-label="Quick-jump to a settings section"
          onClick={() => setSettingsOpen(open => !open)}
          className={`${itemClass(pathname === "/settings")} rounded-l-none border-l border-board px-2`}
        >
          <ChevronDown size={12} className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
        </button>

        {settingsOpen && (
          <div
            id="student-settings-submenu"
            className="fixed left-4 right-4 top-[108px] z-50 grid gap-1 rounded-xl border border-board3 bg-board2 p-2 shadow-2xl sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+0.45rem)] sm:w-64"
          >
            {settingsItems.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setSettingsOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-chalkdim hover:bg-board3 hover:text-chalk"
                >
                  <Icon size={15} className="text-amber" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {standardItems.map(item => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={itemClass(pathname === item.href, item.accent)}>
            <Icon size={13} />
            {item.label}
            {item.indicator && <NewMaterialsIndicator variant="dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
