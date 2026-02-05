// Basic Service Worker for PWA Installability
self.addEventListener('install', (event) => {
    console.log('[PWA] Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[PWA] Service Worker activated');
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through for now
    event.respondWith(fetch(event.request));
});
