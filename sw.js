self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("focusflow").then(cache => {
      return cache.addAll(["/", "/index.html", "/assets/css/style.css", "/assets/js/app.js"]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
