import { DEV_BYPASS_LOGIN } from "@/lib/dev-mode";

/**
 * A deliberately loud, impossible-to-miss banner — the whole point is
 * that this is visible on the live site itself, not just a code
 * comment someone has to remember to go read. Rendered at the top of
 * every portal layout (student/parent/admin/school) whenever
 * DEV_BYPASS_LOGIN is true. Renders nothing at all when it's false —
 * removing it from view is as simple as flipping that one flag.
 */
export function DevBypassBanner() {
  if (!DEV_BYPASS_LOGIN) return null;
  return (
    <div className="w-full bg-terracotta px-4 py-2 text-center text-xs font-bold text-white">
      🧪 TESTING MODE — login bypass is active. Anyone can enter any portal with no
      credentials. Turn off DEV_BYPASS_LOGIN in lib/dev-mode.ts before marketing.
    </div>
  );
}
