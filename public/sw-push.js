// Flick web push service worker.
// Handles push events when app is open/backgrounded/closed and routes clicks to deep links.

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: 'Flick', body: event.data?.text() ?? '' }; }
  const title = payload.title || 'Flick';
  const tag = payload.tag || payload.dedupe_id || payload.kind || 'flick';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag, // dedupe: same tag replaces previous notification
    renotify: !!payload.renotify,
    data: { url: payload.url || '/', kind: payload.kind || null, id: payload.id || null },
    actions: payload.actions || [],
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      try {
        const u = new URL(c.url);
        if (u.origin === self.location.origin) {
          await c.focus();
          c.postMessage({ type: 'push-navigate', url });
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(url);
  })());
});