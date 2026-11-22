// Cryalune's restricted media relay proof-of-concept.
// This is NOT an open proxy. It can fetch only Cryalune's original demo clip.
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
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  headers.set('Vary', 'Origin');
}

export function makeWorker(fetchUpstream = fetch) {
  return {
    async fetch(request) {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin') || '';
      if (origin && !ALLOWED_ORIGINS.has(origin)) return reply('Origin not allowed', 403);
      if (!['GET','HEAD','OPTIONS'].includes(request.method)) return reply('Method not allowed', 405, origin);

      if (url.pathname === '/health' && request.method === 'GET' && !url.search) {
        return reply('Cryalune demo relay ready; no anime sources connected', 200, origin);
      }
      if (url.pathname !== '/demo.mp4' || url.search) return reply('Not found', 404, origin);

      if (request.method === 'OPTIONS') {
        const headers = new Headers();
        if (origin) addCors(headers, origin);
        return new Response(null, {status:204, headers});
      }
      const range = request.headers.get('Range');
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return reply('Invalid byte range', 400, origin);

      const requestHeaders = new Headers();
      if (range) requestHeaders.set('Range', range);
      try {
        const upstream = await fetchUpstream(DEMO_URL, {
          method:request.method, headers:requestHeaders, redirect:'error', signal:request.signal
        });
        if (![200,206,416].includes(upstream.status)) return reply('Demo source unavailable', 502, origin);
        const headers = new Headers();
        for (const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','cache-control']) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set('X-Content-Type-Options', 'nosniff');
        if (origin) addCors(headers, origin);
        // Passing the upstream ReadableStream avoids buffering an entire movie.
        return new Response(request.method === 'HEAD' ? null : upstream.body, {
          status:upstream.status, headers
        });
      } catch {
        return reply('Demo source unavailable', 502, origin);
      }
    }
  };
}

export default makeWorker();
