
const CACHE = 'salon-acct-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './ledger.js',
  './cost_analyzer.js',
  './app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
