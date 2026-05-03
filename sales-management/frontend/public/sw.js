/**
 * Service Worker thay thế: gỡ cache cũ và hủy đăng ký — không có fetch handler,
 * nên sau khi activate xong mọi request đi thẳng ra mạng (không còn chặn 404).
 */
self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return caches.delete(key)
          })
        )
      })
      .then(function () {
        return self.registration.unregister()
      })
  )
})
