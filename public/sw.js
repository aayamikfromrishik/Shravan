// SHRAVAN service worker: shows phone notifications (e.g. "this book is free for 3 days")
// and keeps the Downloads page working without internet (saved lessons live in IndexedDB).
const PAGES = 'shravan-pages-v1';
const ASSETS = 'shravan-assets-v1';

// Keep the Downloads page and the files it needs, so it opens with no internet.
async function cacheDownloadsPage() {
  const res = await fetch('/downloads', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put('/downloads', res);
  const files = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
  const assets = await caches.open(ASSETS);
  await Promise.all(files.map((f) => assets.add(f).catch(() => {})));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(cacheDownloadsPage().catch(() => {}));
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // App files never change once published (their names include a fingerprint): cache first.
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: always fresh when online; with no internet, open Downloads.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === '/downloads') {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put('/downloads', copy));
          }
          return res;
        })
        .catch(async () => (await caches.match('/downloads')) || new Response('You are offline.', { headers: { 'Content-Type': 'text/plain' } })),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'SHRAVAN', body: '', link: '/' };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link: data.link },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(link);
          return c.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
