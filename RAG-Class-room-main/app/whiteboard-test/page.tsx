"use client";
import dynamic from "next/dynamic";
const Whiteboard = dynamic(() => import("@/components/WhiteboardCommandEngine"), { ssr: false });

const plan = {
  version: 1,
  autoplay: true,
  commands: [
    { id: "ml", action: "write", text: "മലയാളം കൈയെഴുത്ത് പരീക്ഷണം — വളരെ നീളമുള്ള വരി സ്വയമേവ പൊതിയണം", fontSize: 24, durationMs: 120 },
    { id: "en", action: "write", text: "Accurate measured wrapping and overflow pagination", fontSize: 22, durationMs: 120 },
    { id: "u1", action: "underline", target: "ml", durationMs: 100 },
    { id: "a1", action: "arrow", from: "ml", to: "en", durationMs: 100 },
    { id: "e1", action: "erase", target: "ml", durationMs: 100 },
    { id: "l3", action: "write", text: "Third line forces page-aware layout on a small board", fontSize: 22, durationMs: 120 },
    { id: "l4", action: "write", text: "Fourth line must remain inside the canvas", fontSize: 22, durationMs: 120 },
  ],
};

export default function WhiteboardTestPage() {
  return <main style={{ padding: 20 }}><Whiteboard plan={plan} width={360} height={190}/></main>;
}
