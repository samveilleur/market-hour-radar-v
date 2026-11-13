// Service worker — Market Hours Radar
// Met en cache l'appli statique pour l'usage hors-ligne et l'installation PWA.
const CACHE_NAME = "mhr-v1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "time.js",
  "manifest.json",
  "pwa-icon-192.png",
  "pwa-icon-512.png"
];

// Installation : met en cache les fichiers statiques.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : supprime les vieux caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Stratégie cache-first avec mise à jour en arrière-plan pour le HTML/JS/CSS.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // On ne met en cache que les requêtes de même origine.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
