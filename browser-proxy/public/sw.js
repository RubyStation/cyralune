/* Only intercept requests owned by Scramjet v2. Leave the site's other requests alone. */
importScripts('/controller/controller.sw.js');

self.addEventListener('fetch', (event) => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  }
});
