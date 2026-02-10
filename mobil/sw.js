// Service Worker para GeoTool Forestal TVH
// Estrategia: Cache-First para recursos estáticos, Network-First para datos

const CACHE_NAME = 'geotool-v1';
const RUNTIME_CACHE = 'geotool-runtime';

// Recursos a cachear en la instalación
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.2/proj4.js',
    'https://unpkg.com/shpjs@latest/dist/shp.js',
    'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&family=IBM+Plex+Mono:wght@500;700&display=swap'
];

// Instalación: Cachear recursos estáticos
self.addEventListener('install', event => {
    console.log('[SW] Instalando Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cacheando recursos estáticos');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación: Limpiar cachés antiguos
self.addEventListener('activate', event => {
    console.log('[SW] Activando Service Worker...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map(name => {
                        console.log('[SW] Eliminando caché antiguo:', name);
                        return caches.delete(name);
                    })
            );
        })
        .then(() => self.clients.claim())
    );
});

// Fetch: Estrategia híbrida
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar requests no-HTTP
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Estrategia para tiles de mapa: Cache-First con fallback
    if (url.hostname.includes('google.com') || 
        url.hostname.includes('openstreetmap.org')) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) {
                        return cached;
                    }
                    
                    return fetch(request)
                        .then(response => {
                            // Cachear tiles exitosos
                            if (response.status === 200) {
                                const cloned = response.clone();
                                caches.open(RUNTIME_CACHE)
                                    .then(cache => cache.put(request, cloned));
                            }
                            return response;
                        })
                        .catch(() => {
                            // Tile offline placeholder
                            return new Response(
                                '<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" fill="#2d343d"/><text x="128" y="128" text-anchor="middle" fill="#5f6368" font-size="14">Sin conexión</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        });
                })
        );
        return;
    }
    
    // Estrategia para recursos estáticos: Cache-First
    if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
        event.respondWith(
            caches.match(request)
                .then(cached => cached || fetch(request))
        );
        return;
    }
    
    // Estrategia por defecto: Network-First
    event.respondWith(
        fetch(request)
            .then(response => {
                // Cachear respuestas exitosas en runtime
                if (response.status === 200) {
                    const cloned = response.clone();
                    caches.open(RUNTIME_CACHE)
                        .then(cache => cache.put(request, cloned));
                }
                return response;
            })
            .catch(() => {
                // Fallback a caché si falla la red
                return caches.match(request)
                    .then(cached => {
                        if (cached) {
                            return cached;
                        }
                        
                        // Página offline genérica
                        if (request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Sincronización en background (Background Sync API)
self.addEventListener('sync', event => {
    console.log('[SW] Background Sync:', event.tag);
    
    if (event.tag === 'sync-captures') {
        event.waitUntil(syncCaptures());
    }
});

async function syncCaptures() {
    try {
        // Obtener datos pendientes de sincronización
        const db = await openDatabase();
        const pendingData = await getPendingData(db);
        
        if (pendingData.length === 0) {
            return;
        }
        
        // Sincronizar con servidor (implementar según backend)
        // const response = await fetch('/api/sync', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(pendingData)
        // });
        
        // if (response.ok) {
        //     await clearPendingData(db);
        //     await notifyUser('Datos sincronizados correctamente');
        // }
        
        console.log('[SW] Sincronización completada');
    } catch (error) {
        console.error('[SW] Error en sincronización:', error);
    }
}

// Notificaciones Push (si se implementa servidor)
self.addEventListener('push', event => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        data: data,
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Cerrar' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Utilidades
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GeoToolDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('pending')) {
                db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getPendingData(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pending'], 'readonly');
        const store = transaction.objectStore('pending');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function clearPendingData(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pending'], 'readwrite');
        const store = transaction.objectStore('pending');
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function notifyUser(message) {
    return self.registration.showNotification('GeoTool Forestal', {
        body: message,
        icon: '/icon-192.png'
    });
}

console.log('[SW] Service Worker cargado');
