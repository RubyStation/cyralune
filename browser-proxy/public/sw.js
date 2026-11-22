/* Scramjet handles URLs under its configured proxy prefix, not all browser requests. */
importScripts('/scram/scramjet.all.js');

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const proxyWorker = new ScramjetServiceWorker();

self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    await proxyWorker.loadConfig();
    return proxyWorker.route(event) ? proxyWorker.fetch(event) : fetch(event.request);
  })());
});
