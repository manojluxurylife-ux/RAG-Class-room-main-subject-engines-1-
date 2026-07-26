/** AI Guru offline shell.
 * Generated study materials themselves live in IndexedDB (lib/offline-materials.ts).
 * This worker keeps the application shell and already-used JS/CSS/image assets available.
 */
const VERSION = "v1785052814445";
const SHELL_CACHE = `gg-shell-${VERSION}`;
const RUNTIME_CACHE = `gg-runtime-${VERSION}`;
const SHELL_ASSETS = [
  "/", "/dashboard", "/offline-library", "/material-studio", "/study-materials",
  "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => Promise.allSettled(SHELL_ASSETS.map(url => cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  // Next.js chunks, fonts, icons and images: cache-first after first download.
  if (url.pathname.startsWith("/_next/static/") || /\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|mjs)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        try {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, responseToCache));
        } catch (e) {
          console.error("Cache put failed:", e);
        }
      }
      return response;
    })));
    return;
  }

  // Pages: network-first so updates arrive normally, then use the last cached shell offline.
  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      try {
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, responseToCache));
      } catch (e) {
        console.error("Cache put failed:", e);
      }
    }
    return response;
  }).catch(async () => {
    return (await caches.match(request)) || (await caches.match("/offline-library")) || (await caches.match("/")) || Response.error();
  }));
});
