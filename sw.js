const CACHE_VERSION = '20260714-1'
const SHELL_CACHE = `myfmlv-etf-shell-${CACHE_VERSION}`
const DATA_CACHE = `myfmlv-etf-data-${CACHE_VERSION}`
const APP_SHELL = [
  './',
  './index.html',
  './etf-app.css',
  './src/etf-app.js',
  './manifest.webmanifest',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
]
const OFFLINE_DATA = ['./data/etf-universe.json']

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)),
    caches.open(DATA_CACHE).then((cache) => cache.addAll(OFFLINE_DATA)),
  ]).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  const currentCaches = new Set([SHELL_CACHE, DATA_CACHE])
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('myfmlv-etf-') && !currentCaches.has(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) return cached
    if (fallbackPath) {
      const fallback = await caches.match(fallbackPath, { ignoreSearch: true })
      if (fallback) return fallback
    }
    return new Response('오프라인에서 사용할 수 없는 요청입니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, './index.html'))
    return
  }
  if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }
  event.respondWith(cacheFirst(request))
})
