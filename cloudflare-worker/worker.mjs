// Cryalune's isolated Cloudflare video playback test.
// Fetch only the original Firebase clip; if that fails, serve the bundled copy.
// This is not an open proxy and cannot fetch arbitrary user-supplied URLs.
const DEMO_URL = 'https://cryalune.firebaseapp.com/assets/cyralune-demo.mp4';
const ALLOWED_ORIGINS = new Set([
  'https://cryalune.firebaseapp.com',
  'https://cryalune.web.app'
]);

function reply(message, status, origin = '') {
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  if (origin) addCors(headers, origin);
  return new Response(JSON.stringify({message}), {status, headers});
}

function addCors(headers, origin) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, X-Cryalune-Video-Source');
  headers.set('Vary', 'Origin');
}

export function makeWorker(
  fetchUpstream = fetch,
  fetchBackup = (request, env) => env.ASSETS.fetch(request)
) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin') || '';
      if (origin && !ALLOWED_ORIGINS.has(origin)) return reply('Origin not allowed', 403);
      if (!['GET','HEAD','OPTIONS'].includes(request.method)) return reply('Method not allowed', 405, origin);

      if (url.pathname === '/health' && request.method === 'GET' && !url.search) {
        return reply('Cryalune video demo ready; Firebase fetch with bundled backup', 200, origin);
      }
      // Chat apps sometimes append utm_source. Ignore only tracking parameters.
      const trackingOnly = [...url.searchParams.keys()].every((key) => /^utm_[a-z0-9_]+$/i.test(key));
      if (url.pathname !== '/demo.mp4' || !trackingOnly) return reply('Not found', 404, origin);

      if (request.method === 'OPTIONS') {
        const headers = new Headers();
        if (origin) addCors(headers, origin);
        return new Response(null, {status:204, headers});
      }
      const range = request.headers.get('Range');
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return reply('Invalid byte range', 400, origin);

      const mediaHeaders = new Headers();
      if (range) mediaHeaders.set('Range', range);

      // First try the fixed, trusted Firebase URL. Do not send browser cookies,
      // authentication headers, or any caller-controlled upstream URL.
      let media;
      let source;
      try {
        const response = await fetchUpstream(DEMO_URL, {
          method:request.method, headers:mediaHeaders, signal:request.signal
        });
        if ([200,206,416].includes(response.status) && (
          response.status === 416 || /^(video\/|application\/octet-stream)/i.test(response.headers.get('Content-Type') || '')
        )) {
          media = response;
          source = 'firebase';
        }
      } catch {
        // The bundled clip provides an independent fallback for the test.
      }

      if (!media) {
        try {
          const backupRequest = new Request(new URL('/demo.mp4', url), {
            method:request.method, headers:mediaHeaders, signal:request.signal
          });
          const response = await fetchBackup(backupRequest, env);
          if ([200,206,416].includes(response.status)) {
            media = response;
            source = 'bundled';
          }
        } catch {
          // Both known video sources were unavailable.
        }
      }
      if (!media) return reply('Demo sources unavailable', 502, origin);

      try {
        const headers = new Headers();
        for (const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','cache-control']) {
          const value = media.headers.get(name);
          if (value) headers.set(name, value);
        }
        if (media.status !== 416) headers.set('Content-Type', 'video/mp4');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('X-Cryalune-Video-Source', source);
        if (origin) addCors(headers, origin);
        // Firebase can return 206 for seeking. Static Assets currently returns
        // 200 for ranges, which is acceptable for this very small fallback.
        return new Response(request.method === 'HEAD' ? null : media.body, {
          status:media.status, headers
        });
      } catch {
        return reply('Demo sources unavailable', 502, origin);
      }
    }
  };
}

export default makeWorker();
