"use client";
import { useEffect } from "react";

/** Registers the service worker once, client-side only. Silently no-ops
 *  in unsupported browsers or non-HTTPS local dev over plain HTTP LAN IPs. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Fails silently — e.g. on http:// dev origins where SW isn't allowed.
      // Not critical: the app works fully without it, just without
      // installability / Share Target support in that case.
    });
  }, []);
  return null;
}
