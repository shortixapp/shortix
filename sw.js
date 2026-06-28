// Version this string every deploy to bust old caches immediately.
// Format: 'shortix-v<YYYY-MM-DD>' — update on each release.
const CACHE = 'shortix-v2026-06-28';

const SHELL = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/stats.html',
  '/404.html',
  '/css/styles.css',
  '/js/i18n.js',
  '/js/auth.js',
  '/js/data.js',
  '/js/main.js',
  '/js/dashboard.js',
  '/js/stats.js',
  '/js/stripe.js',
  '/manifest.json',
  '/images/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // Delete ALL old caches (any name that isn't the current CACHE)
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Never cache API calls — only static shell assets
  if (request.url.includes('/.netlify/functions/')) return;
  // Never cache Supabase or CDN requests
  if (request.url.includes('supabase.co') || request.url.includes('cdn.jsdelivr')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok && request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => cached);
      // Return cache immediately, update in background (stale-while-revalidate)
      return cached || network;
    })
  );
});
