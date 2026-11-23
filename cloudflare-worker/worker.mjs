// Cryalune's isolated Cloudflare video playback test.
// The small original demo clip is deployed as a Worker static asset, so playback
// does not depend on fetching an upstream copy from Firebase.
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
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  headers.set('Vary', 'Origin');
}

export function makeWorker(fetchDemo = (request, env) => env.ASSETS.fetch(request)) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin') || '';
      if (origin && !ALLOWED_ORIGINS.has(origin)) return reply('Origin not allowed', 403);
      if (!['GET','HEAD','OPTIONS'].includes(request.method)) return reply('Method not allowed', 405, origin);

      if (url.pathname === '/health' && request.method === 'GET' && !url.search) {
        return reply('Cryalune video demo ready; clip stored with this Worker', 200, origin);
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

      const assetHeaders = new Headers();
      if (range) assetHeaders.set('Range', range);
      try {
        const assetRequest = new Request(new URL('/demo.mp4', url), {
          method:request.method, headers:assetHeaders, signal:request.signal
        });
        const asset = await fetchDemo(assetRequest, env);
        if (![200,206,416].includes(asset.status)) return reply('Demo asset unavailable', 502, origin);
        const headers = new Headers();
        for (const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','cache-control']) {
          const value = asset.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set('Content-Type', 'video/mp4');
        headers.set('X-Content-Type-Options', 'nosniff');
        if (origin) addCors(headers, origin);
        // Static Assets currently returns 200 for Range requests. That is fine
        // for this tiny test clip; full-length videos should use R2 byte ranges.
        return new Response(request.method === 'HEAD' ? null : asset.body, {
          status:asset.status, headers
        });
      } catch {
        return reply('Demo asset unavailable', 502, origin);
      }
    }
  };
}

export default makeWorker();
