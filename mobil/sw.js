// Service Worker para GeoTool Forestal TVH
const CACHE_NAME = 'GeoTool Forestal TVH'; // ⬆️ Incrementada la versión
const BASE_PATH = '/jmt/mobil'; // ✅ Ya lo tienes definido

// ✅ CORRECCIÓN: Ahora SÍ usamos BASE_PATH en las rutas
const ASSETS_TO_CACHE = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/app.js`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/manifest.json`
];

// Instalación
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando archivos:', ASSETS_TO_CACHE);
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => {
                console.error('[SW] Error al cachear:', err);
            })
    );
    self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando cache antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Estrategia: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es exitosa, guardarla en cache
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, buscar en cache
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // ✅ CORRECCIÓN: Si no encuentra nada, redirige al index
                        return caches.match(`${BASE_PATH}/index.html`);
                    });
            })
    );
});
