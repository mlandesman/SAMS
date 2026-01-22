// Service worker for SAMS PWA - Zero Cache Policy
// This Service Worker exists ONLY to enable PWA installability
// It does NOT cache any resources - all requests pass directly to network

// Install event - minimal, just activate
self.addEventListener('install', (event) => {
  event.waitUntil(
    self.skipWaiting() // Activate immediately
  );
});

// Fetch event - network only, NO caching
// API requests bypass Service Worker entirely to avoid CORS issues
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // API paths that should bypass Service Worker entirely
  // This prevents CORS preflight issues and ensures direct network access
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
  
  // Check if this is an API request
  const isApiRequest = API_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
  
  if (isApiRequest) {
    // Don't intercept API requests - let them go directly to network
    // This avoids CORS preflight issues and ensures zero caching
    return; // Let the browser handle the request directly
  }
  
  // For non-API requests (HTML, JS, CSS, images), pass directly to network
  // NO caching, NO offline fallback, NO stale-while-revalidate
  event.respondWith(fetch(event.request));
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Take control immediately
      await self.clients.claim();
      
      // Notify all clients that Service Worker has activated
      // Main thread will handle version checking
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED'
        });
      });
    })()
  );
});
