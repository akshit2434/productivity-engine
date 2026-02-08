const CACHE_NAME = 'entropy-cache-v2';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/web-app-manifest-192x192.png',
    '/web-app-manifest-512x512.png',
];

// Patterns for assets that should be cache-first (static chunks, fonts, etc.)
const CACHE_FIRST_PATTERNS = [
    /\/_next\/static\//,
    /\.(png|jpg|jpeg|gif|svg|ico)$/,
    /\.(woff|woff2|ttf|otf|eot)$/,
];

// Install: Cache basic app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
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

// Fetch strategies
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.location.origin)) return;

    const url = new URL(event.request.url);
    const isCacheFirst = CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname));

    if (isCacheFirst) {
        // Cache-First with Network Fallback & Update
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cacheCopy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, cacheCopy);
                        });
                    }
                    return networkResponse;
                });
            })
        );
    } else {
        // Stale-While-Revalidate for App Shell / API
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cacheCopy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, cacheCopy);
                        });
                    }
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
    }
});
