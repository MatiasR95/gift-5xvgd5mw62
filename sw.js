// Pages: network-first, so a redeploy to the same URL (e.g. when the real tickets arrive)
// shows up on the very next open; cache only when offline.
// Assets: stale-while-revalidate (filenames are hashed). Bump CACHE to force a clean cache;
// the name is duplicated in src/main.tsx.
const CACHE = 'gift-v2'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // clone now: the body is consumed by the page before an async cache write would run
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
          return res
        })
        .catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match('./index.html')),
    )
    return
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' })
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        })
        .catch(() => hit || (req.mode === 'navigate' ? cache.match('./index.html') : undefined))
      return hit || net
    }),
  )
})
