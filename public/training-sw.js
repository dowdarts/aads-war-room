// Scoped to training.html only (see registration call). No caching/offline
// behavior and no push handler — this app stores everything in localStorage
// and never talks to a server. This SW exists purely so the page satisfies
// installability requirements.
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request))
})

// Without these, an already-registered older version of this file keeps
// controlling the page indefinitely — updates only normally activate once
// every tab using the old version is fully closed. This forces the newest
// version to take over immediately.
self.addEventListener('install', function () {
  self.skipWaiting()
})
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})
