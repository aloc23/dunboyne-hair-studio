const CACHE_NAME = 'salon-acct-v2';
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  // CSS files
  'styles.css',
  'modern-dark-theme.css',
  'icons.css',
  // JavaScript files
  'app.js',
  'data.js',
  'storage.js',
  'ledger.js',
  'reports.js',
  'matrix-nova-enhancements.js',
  'catalog.js',
  'cost.js',
  'cost_analyzer.js',
  'db.js',
  'importer.js',
  'lib-idb.js',
  'logic.js',
  'seed-data.js',
  'seed.js',
  'store.js',
  'sw-register.js',
  // Data files
  'services_seed.json',
  'seed.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim(); // Take control of all clients
      })
  );
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }

        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Don't cache error responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cache successful responses for future use
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Service Worker: Network fetch failed', error);
            // Return a fallback page or offline indicator if needed
            throw error;
          });
      })
  );
});
