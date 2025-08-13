const CACHE_NAME = 'salon-acct-v3';
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

// Dynamic cache for user data and generated content
const DYNAMIC_CACHE = 'salon-acct-dynamic-v3';

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
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
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

// Fetch event - enhanced offline support with better error handling
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
            const cacheName = STATIC_ASSETS.includes(event.request.url.replace(self.location.origin + '/', '')) 
              ? CACHE_NAME 
              : DYNAMIC_CACHE;
              
            caches.open(cacheName)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Service Worker: Network fetch failed', error);
            
            // Return offline fallback for specific requests
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            // For other requests, let the app handle the offline state
            throw error;
          });
      })
  );
});

// Background sync for when connection is restored
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(
      // Notify the main app that connection is restored
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_RESTORED' });
        });
      })
    );
  }
});

// Handle offline/online status
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
