// Service worker for SAMS PWA with version-based cache busting
const CACHE_VERSION = '5.1.0-no-api-cache';
const CACHE_NAME = `sams-v${CACHE_VERSION}-${new Date().getTime()}`;
const urlsToCache = [
  '/',
  '/manifest.json',
  '/SLP_Icon.png'
];

// API paths that should NEVER be cached (always network-only)
// These are the Firebase backend API routes served via hosting rewrites
const API_PATH_PREFIXES = [
  '/clients/',
  '/hoadues/',
  '/water/',
  '/reports/',
  '/payments/',
  '/budgets/',
  '/admin/',
  '/propane/',
  '/api/'
];

// Check if a URL is an API call
const isApiCall = (pathname) => {
  return API_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
};

// Static assets that CAN be cached (only actual static files)
const isStaticAsset = (pathname) => {
  return pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
};

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

// Fetch event - API calls NEVER cached, static assets can be cached
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: ALWAYS network-only, NEVER cache
  if (isApiCall(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return error for offline API calls
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // HTML navigation: Network first, fallback to cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the page for offline fallback
          if (request.method === 'GET' && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || caches.match('/');
          });
        })
    );
    return;
  }

  // Static assets: Cache first, network fallback (but only actual static files)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
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
          return caches.match('/');
        })
    );
    return;
  }

  // Everything else: Network only (don't cache unknown paths)
  event.respondWith(fetch(request));
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