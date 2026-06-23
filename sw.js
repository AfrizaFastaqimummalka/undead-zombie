// sw.js — Service Worker
const CACHE_NAME = 'undead-kingdom-v2';
const urlsToCache = [
  './',
  './index.html',
  './src/game.js',
  './src/ui.js',
  './src/state.js',
  './src/player.js',
  './src/weapons.js',
  './src/zombies.js',
  './src/world.js',
  './src/effects.js',
  './src/audio.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME && caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Skip file besar — GLB, HDR, MP4, MP3 tidak di-cache SW
  const url = new URL(req.url);
  if (url.pathname.match(/\.(glb|hdr|mp4|mp3|mkv)$/i)) return;
  // Skip CDN eksternal
  if (!req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, resClone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
