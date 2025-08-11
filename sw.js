self.addEventListener('install', e=>{
  e.waitUntil(caches.open('salon-acct-v1').then(c=>c.addAll(['./','index.html','styles.css','app.js','data.js','storage.js','ledger.js','reports.js'])));
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
