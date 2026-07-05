const CACHE_NAME = 'smart-stock-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Bypass caching for API requests, database queries, and non-GET requests to ensure real-time accuracy.
  if (
    url.pathname.startsWith('/api') || 
    url.hostname.includes('firebase') || 
    url.hostname.includes('googleapis') ||
    event.request.method !== 'GET'
  ) {
    return; // Fetch directly from live network
  }

  // Network-First Strategy:
  // We ALWAYS attempt to fetch from the network first. This ensures the client
  // gets the absolute latest changes immediately when online.
  // If the network request fails (e.g., user is offline), we fallback to the Cache.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache new static assets dynamically if valid
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          url.origin === self.location.origin &&
          !url.pathname.startsWith('/api')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed (offline), look for it in the cache
        return caches.match(event.request);
      })
  );
});
