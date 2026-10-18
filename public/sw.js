/*
 * Service worker: aplikacija radi i offline (u zgradi fakulteta nema signala).
 *
 * Strategija:
 *  - navigacije (otvaranje appa): uvijek kontekst mreže, s kešom kao rezervom
 *  - statični resursi (JS/CSS/ikone/slova): "stale-while-revalidate"
 *
 * Na svaku novu verziju mijenjamo CACHE pa se stari fajlovi uklone.
 */
const CACHE = 'pazi-ispit-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigacija: mreža prvo (da korisnik uvijek dobije novi build), keš kao rezerva.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r ?? Response.error())),
    );
    return;
  }

  // Google Fonts i slični cross-origin resursi: keširaj samo uspješne.
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
