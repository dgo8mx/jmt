// SiPlaFor Service Worker v2.0
// Estrategia: Cache-first para assets, Network-first para Supabase
const CACHE_NAME = 'siplafor-v2';
const STATIC_ASSETS = [
  './app.html',
  './manifest.json',
];
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// Instalar y pre-cachear
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Static: con CORS normal
      cache.addAll(STATIC_ASSETS).catch(() => {});
      // CDN: no-cors
      CDN_ASSETS.forEach(url => {
        fetch(new Request(url, { mode: 'no-cors' }))
          .then(resp => cache.put(url, resp))
          .catch(() => {});
      });
    })
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ── Supabase: Network-first (sin caché) ──────────────────
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión a Supabase' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        ))
    );
    return;
  }

  // ── Tiles de mapa OSM: Cache-first con actualización en fondo ─
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(resp => {
            cache.put(request, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ── Demás recursos: Cache-first ──────────────────────────
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp.ok || resp.type === 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return resp;
      }).catch(() => {
        // Fallback para la app
        if (request.destination === 'document') {
          return caches.match('./app.html');
        }
      });
    })
  );
});

// Mensaje desde la app para forzar actualización
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
