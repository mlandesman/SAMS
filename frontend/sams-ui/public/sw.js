// Service worker for SAMS PWA with version-based cache busting
const CACHE_VERSION = '5.0.0-firebase';
const CACHE_NAME = `sams-v${CACHE_VERSION}-${new Date().getTime()}`;
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache resources and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become active
        self.skipWaiting();
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
      })
  );
});

// Fetch event - network first for HTML, cache first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network first for HTML and API calls
  if (request.mode === 'navigate' || request.headers.get('accept').includes('text/html') || url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache GET requests
          if (request.method === 'GET') {
            // Clone the response before caching
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline (only for GET requests)
          if (request.method === 'GET') {
            return caches.match(request).then((response) => {
              return response || caches.match('/');
            });
          }
          // For non-GET requests, return error
          return new Response('Network error', { status: 503 });
        })
    );
    return;
  }

  // Network first for CSS files, cache first for other static assets
  if (request.url.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the CSS file
          if (response && response.status === 200 && response.type === 'basic' && request.method === 'GET') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache if offline
          return caches.match(request).then((response) => {
            return response || caches.match('/');
          });
        })
    );
  } else {
    // Cache first for other static assets
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          // Fetch from network and cache
          return fetch(request).then((response) => {
            // Don't cache non-successful responses or non-GET requests
            if (!response || response.status !== 200 || response.type !== 'basic' || request.method !== 'GET') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return response;
          });
        })
        .catch(() => {
          // Fallback for offline
          return caches.match('/');
        })
    );
  }
});

// Activate event - cleanup old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('sams-v') && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});