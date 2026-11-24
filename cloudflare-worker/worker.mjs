// Cryalune's two restricted Cloudflare playback tests.
// The demo uses Firebase with a bundled fallback; the JJK test streams a fixed
// GitHub Release asset. Neither route accepts arbitrary upstream URLs.
const JJK_RELEASE_URL = 'https://github.com/RubyStation/cyralune/releases/download/jjk-test/Jujutsu.Kaisen.TV.Episode.1.mp4';
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
        return reply('Cryalune video demo ready; Firebase backup and JJK release test route available', 200, origin);
      }
      // Chat apps sometimes append utm_source. Ignore only tracking parameters.
      const trackingOnly = [...url.searchParams.keys()].every((key) => /^utm_[a-z0-9_]+$/i.test(key));
      const jjkTest = url.pathname === '/jjk-test.mp4';
      if ((!jjkTest && url.pathname !== '/demo.mp4') || !trackingOnly) return reply('Not found', 404, origin);

      if (request.method === 'OPTIONS') {
        const headers = new Headers();
        if (origin) addCors(headers, origin);
        return new Response(null, {status:204, headers});
      }
      const range = request.headers.get('Range');
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return reply('Invalid byte range', 400, origin);

      const mediaHeaders = new Headers();
      if (range) mediaHeaders.set('Range', range);

      // Fetch only the fixed source for this route. Do not send browser cookies,
      // authentication headers, or any caller-controlled upstream URL.
      let media;
      let source;
      try {
        const response = await fetchUpstream(jjkTest ? JJK_RELEASE_URL : DEMO_URL, {
          method:request.method, headers:mediaHeaders, redirect:'follow', signal:request.signal
        });
        if ([200,206,416].includes(response.status) && (
          response.status === 416 || /^(video\/|application\/octet-stream)/i.test(response.headers.get('Content-Type') || '')
        )) {
          media = response;
          source = jjkTest ? 'github-release' : 'firebase';
        }
      } catch {
        // The demo can fall back to its bundled clip; the JJK route reports failure.
      }

      if (!media && !jjkTest) {
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
      if (!media) return reply(jjkTest ? 'JJK release source unavailable' : 'Demo sources unavailable', 502, origin);

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
        // GitHub Releases and Firebase can return 206 for seeking. Static Assets
        // currently returns 200 for ranges (fine for the very small demo).
        return new Response(request.method === 'HEAD' ? null : media.body, {
          status:media.status, headers
        });
      } catch {
        return reply(jjkTest ? 'JJK release source unavailable' : 'Demo sources unavailable', 502, origin);
      }
    }
  };
}

export default makeWorker();
