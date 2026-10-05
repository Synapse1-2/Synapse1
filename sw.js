const CACHE_NAME = 'synapse12-v19';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
// Files from other sites that the app needs to start. They are saved once so the app also opens with no internet.
const EXTERNAL = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
];
const EXTERNAL_PATTERN = /gstatic\.com\/firebasejs\/|fonts\.googleapis\.com|fonts\.gstatic\.com/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(EXTERNAL.map((u) => fetch(u, { mode: 'no-cors' }).then((res) => cache.put(u, res))))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Other sites: only the few files the app needs to start (Firebase scripts, fonts). Cache first.
  if (url.origin !== self.location.origin) {
    if (!EXTERNAL_PATTERN.test(url.href)) return;
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); return res;
      }).catch(() => cached))
    );
    return;
  }

  // Pages: network first so a new upload shows up right away, cache as offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Everything else (photos, icons): cache first, refresh in the background.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
