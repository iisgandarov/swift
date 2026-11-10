/* Swift service worker — keeps the app shell available offline.
 * - Navigations: network-first, falling back to the last cached copy of that page (or "/").
 * - Build assets (/_next/static), icons, fonts: cache-first (they are content-hashed / immutable).
 * - API and auth requests are never cached here; data is persisted client-side (IndexedDB).
 */
const VERSION = "swift-v3"; // v3: new app icons (2026-11-10)
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const PRECACHE = ["/", "/calendar", "/focus", "/stats", "/settings", "/new", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon.svg"];

/** Caches the JS/CSS a page needs, so routes open offline even if they were never visited. */
async function cacheAssetsFromHtml(res) {
  try {
    const html = await res.text();
    const urls = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+\.(?:js|css)/g) || [])];
    const cache = await caches.open(ASSET_CACHE);
    await Promise.allSettled(
      urls.map(async (u) => {
        if (!(await cache.match(u))) await cache.add(u);
      }),
    );
  } catch {
    /* best effort */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        PRECACHE.map(async (url) => {
          const res = await fetch(new Request(url, { credentials: "include" }));
          if (!res.ok || res.redirected) return;
          await cache.put(url, res.clone());
          if (res.headers.get("content-type")?.includes("text/html")) await cacheAssetsFromHtml(res);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/sounds/") ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok && !res.redirected) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(url.pathname, res.clone());
            event.waitUntil(cacheAssetsFromHtml(res.clone()));
          }
          return res;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(url.pathname)) ||
            (await cache.match("/")) ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }
      })(),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })(),
    );
    return;
  }

  // RSC payloads for client-side navigation: network-first with cache fallback
  if (request.headers.get("RSC") === "1") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          const hit = await cache.match(request);
          if (hit) return hit;
          throw new Error("offline");
        }
      })(),
    );
  }
});
