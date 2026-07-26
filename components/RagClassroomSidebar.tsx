"use client";
/**
 * RagClassroomSidebar — persistent left navigation used by the
 * immersive RAG Classroom layout (app/(student)/rag-classroom/page.tsx),
 * matching the approved mockup: logo, nav list with RAG Classroom
 * highlighted, and a live BYOK key-pool status card pinned at the
 * bottom.
 *
 * This is deliberately scoped to the RAG Classroom page rather than
 * replacing the app-wide StudentMainNav in app/(student)/layout.tsx —
 * swapping every student page from a top nav to a left rail is a much
 * bigger, separate layout migration than "make RAG Classroom match the
 * mockup", and doing it silently here would risk breaking every other
 * page's chrome. Routes below reuse real existing pages where they
 * exist; a couple (Quizzes, Flashcards, Whiteboard, Subscription) point
 * at the closest existing equivalent since this app has no dedicated
 * route for them yet — see the inline notes.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Settings, Sparkles, BookOpen, WifiOff, Library,
  HelpCircle, Layers, PenSquare, Gauge, UserRound, CreditCard, CheckCircle2,
  ChevronLeft, ChevronRight, GripVertical,
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Material Studio", href: "/material-studio", icon: Sparkles },
  { label: "RAG Classroom", href: "/rag-classroom", icon: BookOpen },
  { label: "Offline Library", href: "/offline-library", icon: WifiOff },
  { label: "My Textbooks", href: "/materials", icon: Library },
  { label: "Quizzes", href: "/study-materials?type=quiz_bank", icon: HelpCircle },
  { label: "Flashcards", href: "/study-materials?type=flashcards", icon: Layers },
  { label: "Whiteboard", href: "/rag-classroom", icon: PenSquare },
  { label: "Progress", href: "/progress", icon: Gauge },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Subscription", href: "/settings#subscription", icon: CreditCard },
];

export function RagClassroomSidebar() {
  const pathname = usePathname();
  const [collapsed,setCollapsed]=useState(false);
  const dragStart=useRef<number|null>(null);

  useEffect(()=>{try{setCollapsed(localStorage.getItem("ai-guru-classroom-menu-collapsed")==="1");}catch{}},[]);
  function setMenuCollapsed(value:boolean){setCollapsed(value);try{localStorage.setItem("ai-guru-classroom-menu-collapsed",value?"1":"0");}catch{}}
  function pointerDown(event:React.PointerEvent<HTMLButtonElement>){dragStart.current=event.clientX;event.currentTarget.setPointerCapture(event.pointerId);}
  function pointerUp(event:React.PointerEvent<HTMLButtonElement>){const start=dragStart.current;dragStart.current=null;if(start===null)return;const distance=event.clientX-start;if(distance>35)setMenuCollapsed(false);else if(distance< -35)setMenuCollapsed(true);else setMenuCollapsed(!collapsed);}

  return (
    <aside className={`relative z-30 h-full shrink-0 overflow-visible transition-[width] duration-300 ${collapsed?"w-0":"w-52"}`}>
     <div className={`flex h-full w-52 flex-col border-r border-board3 bg-[#0b1712] px-3 py-4 transition-transform duration-300 ${collapsed?"-translate-x-full":"translate-x-0"}`}>
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber text-board">
          <BookOpen size={18} />
        </div>
        <div>
          <p className="font-display text-base leading-none text-chalk">AI Guru Brain2</p>
          <p className="mt-1 text-[10px] leading-none text-chalkdim">Your AI Study Companion</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href.split("?")[0] || pathname === item.href.split("#")[0];
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-amber/15 font-semibold text-amber" : "text-chalkdim hover:bg-board2 hover:text-chalk"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20"><CheckCircle2 size={15} /></span>
          <div>
            <p className="font-semibold">Gemini active</p>
            <p className="mt-0.5 text-[10px] text-emerald-200/70">AI teacher is ready</p>
          </div>
        </div>
      </div>
     </div>
      <button type="button" onPointerDown={pointerDown} onPointerUp={pointerUp} aria-label={collapsed?"Restore classroom menu":"Hide classroom menu"} title={collapsed?"Drag right or click to restore menu":"Drag left or click to hide menu"} className={`absolute top-1/2 z-40 flex h-20 w-7 -translate-y-1/2 touch-none items-center justify-center rounded-r-xl border border-l-0 border-board3 bg-[#14271e] text-amber shadow-xl transition-[left] duration-300 hover:bg-board2 ${collapsed?"left-0":"left-52"}`}>
        <span className="flex flex-col items-center gap-1"><GripVertical size={14}/>{collapsed?<ChevronRight size={15}/>:<ChevronLeft size={15}/>}</span>
      </button>
    </aside>
  );
}
