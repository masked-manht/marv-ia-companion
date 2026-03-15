const CACHE_NAME = 'marvia-v2.1.1';
const PRECACHE_URLS = [
  '/marvia-icon.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  // Auto skip waiting for seamless updates
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // NEVER cache OAuth, auth, API, or Supabase calls
  if (
    url.pathname.startsWith('/~oauth') ||
    url.pathname.startsWith('/auth/') ||
    event.request.url.includes('/functions/') ||
    event.request.url.includes('supabase') ||
    event.request.url.includes('accounts.google.com')
  ) {
    return;
  }

  // NEVER cache HTML navigation requests — always fetch fresh
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/') || caches.match(event.request))
    );
    return;
  }

  // For assets (JS, CSS, images): network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Marv-IA';
  const options = {
    body: data.body || 'Nouveau message',
    icon: '/marvia-icon.png',
    badge: '/marvia-icon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Ouvrir' }],
    requireInteraction: true,
    tag: 'marvia-notification',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
