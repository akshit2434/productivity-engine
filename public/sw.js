const CACHE_NAME = 'entropy-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/manifest.json',
    '/web-app-manifest-192x192.png',
    '/web-app-manifest-512x512.png',
];

// Install: Cache basic app shell
self.addEventListener('install', (event) => {
    console.log('[PWA] Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('[PWA] Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension and other third-party requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Cache the new response
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cacheCopy);
                    });
                }
                return networkResponse;
            }).catch((err) => {
                console.log('[PWA] Fetch failed, serving from cache if available');
                return cachedResponse;
            });

            // Serve from cache if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
