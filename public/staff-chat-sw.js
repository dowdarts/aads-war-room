// Scoped to staff-chat.html only (see registration call). No caching/offline
// behavior — this exists purely so the page satisfies installability
// requirements and so registration.showNotification() has a registration
// to call (required for notifications on iOS).
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request))
})

// Without these, an already-registered older version of this file (e.g. one
// with no push handler) keeps controlling the page indefinitely — updates
// only normally activate once every tab using the old version is fully
// closed. This forces the newest version to take over immediately.
self.addEventListener('install', function () {
  self.skipWaiting()
})
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// Wakes the app (even if fully closed) to show a real push notification,
// sent by the send-staff-chat-push Edge Function whenever someone sends a
// chat message. Title is the sender's name, body is the message preview —
// so the notification banner itself shows who sent it.
self.addEventListener('push', function (event) {
  var data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) {}
  var title = data.title || 'AADS Event Chat'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: 'icon-event-chat.png',
      tag: 'staff-chat',
      renotify: true
    })
  )
})
