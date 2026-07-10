// Minimal service worker: makes HOLTO installable and gives the app shell a
// stale-while-revalidate cache. It deliberately ignores cross-origin requests,
// so API calls to the backend are never cached or intercepted.
const CACHE = "holto-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave the API alone

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || caches.match("/"));
      return cached || network;
    }),
  );
});
