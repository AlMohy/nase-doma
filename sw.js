// Service worker: uloží aplikaci do telefonu, aby šla otevřít i bez signálu. Při změně verze se stará kopie zahodí.
const VERZE = 'nase-doma-v2';
const SOUBORY = ['./', './index.html', './app.css', './app.js', './sync.js', './preklady.js', './otazky.js', './manifest.webmanifest', './ikony/ikona.svg', './ikony/ikona-180.png', './ikony/ikona-192.png', './ikony/ikona-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERZE).then(c => c.addAll(SOUBORY)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERZE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase a cizí adresy nechat být
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERZE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
