/* Service worker «Курсовая ЛТЭТ»: офлайн-работа приложения.
   Сеть и API (нейросети, поиск) через него не кэшируются. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `kursovaya-${VERSION}`;
const RUNTIME = 'kursovaya-runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kursovaya-') && k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(url) || url.pathname.includes('/api/')) return;

  // Страница приложения: сначала сеть (свежая версия), без сети — из кэша.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put('./', copy));
          }
          return resp;
        })
        .catch(() => caches.match('./', { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
    );
    return;
  }

  // Шрифты для PDF — кэш по первому запросу.
  if (url.pathname.includes('/fonts/')) {
    event.respondWith(
      caches.open(RUNTIME).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((resp) => {
              if (resp.ok) cache.put(req, resp.clone());
              return resp;
            }),
        ),
      ),
    );
    return;
  }

  // Файлы приложения (имена с хэшем) — из кэша, иначе из сети.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((resp) => {
          if (resp.ok && url.pathname.includes('/assets/')) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        }),
    ),
  );
});
