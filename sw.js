const CACHE_NAME = "shjj-brief-v11-fresh-nav";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

async function networkFirst(request, cacheable = true) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (cacheable && response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.endsWith("/data/law_updates.json")) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, true));
    return;
  }

  if (url.origin === self.location.origin) {
    if (
      event.request.destination === "script" ||
      event.request.destination === "style" ||
      event.request.destination === "manifest" ||
      url.pathname.endsWith("/index.html")
    ) {
      event.respondWith(networkFirst(event.request, true));
      return;
    }
  }

  if (url.hostname.includes("open-meteo.com")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.pathname.endsWith("/manifest.json")) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }

      if (clients.openWindow) {
        return clients.openWindow("./index.html");
      }
    })
  );
});
