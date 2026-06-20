// Scoped to cue-light.html only (see registration call). No caching/offline
// behavior — this exists purely so the page satisfies installability
// requirements and so registration.showNotification() has a registration
// to call (required for notifications on iOS).
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request))
})
