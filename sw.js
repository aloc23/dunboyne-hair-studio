
self.addEventListener('install', e=>{
  e.waitUntil(caches.open('salon-acct-cache-v1').then(c=>c.addAll([
    './','./index.html','./styles.css','./app.js','./db.js','./ledger.js','./reports.js','./cost.js','./importer.js','./manifest.webmanifest'
  ])));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
