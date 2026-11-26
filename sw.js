// Guarda la app en el dispositivo para que abra rápido y sin conexión.
// Cambia VERSION cuando publiques cambios para que los celulares los reciban.
const VERSION = "pendientes-v6";
const ARCHIVOS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "config.js",
  "vendor/supabase.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" evita copiar archivos viejos de la caché del navegador.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para tener siempre lo último); si no hay conexión, la copia guardada.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    // "no-cache": siempre pregunta al servidor si hay una versión nueva
    // (GitHub Pages deja los archivos 10 minutos en la caché del navegador).
    fetch(new Request(url.href, { cache: "no-cache", credentials: "same-origin" }))
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
