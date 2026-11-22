// Cyralune's browser-side HTML renderer for the jsDelivr starter.
// Only navigations inside this repository's nyx-static directory are handled.
const BASE_PATH = "/gh/RubyStation/cyralune@main/nyx-static/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  if (!url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) return;

  event.respondWith((async () => {
    if (url.pathname.endsWith("/")) url.pathname += "index.html";

    const response = await fetch(url.href, { cache: "no-cache" });
    if (!response.ok) return response;

    const headers = new Headers(response.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.delete("content-disposition");
    headers.delete("content-length");
    headers.delete("content-encoding");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  })());
});
