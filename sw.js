/* Rally Stage – Offline-Cache.
   Bei jedem Release die Version erhöhen, damit alte Dateien ersetzt werden. */
const CACHE = 'rally-stage-v131';
const CORE = ['./', './index.html', './assets/lancia.glb', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(url => c.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const cdn = /cdn\.jsdelivr\.net$/.test(url.hostname);

  // Seitenaufrufe: erst Netz (Updates kommen an), offline aus dem Cache.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const hit = await caches.match('./index.html');
        return hit || new Response('Rally Stage ist offline nicht verfügbar.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  if (!sameOrigin && !cdn) return;

  // Assets & Bibliotheken: Cache zuerst, sonst laden und ablegen.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
