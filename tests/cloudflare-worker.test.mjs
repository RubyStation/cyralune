import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorker} from '../cloudflare-worker/worker.mjs';

const endpoint = 'https://cryalune-media-demo.example.workers.dev';
const allowed = 'https://cryalune.firebaseapp.com';
const originHeaders = {Origin:allowed};

test('demo fetches the fixed Firebase clip with byte ranges first', async () => {
  const calls = [];
  const worker = makeWorker(
    async (url, options) => {
      calls.push({url,options});
      return new Response('demo', {status:206, headers:{
        'Content-Type':'video/mp4', 'Content-Range':'bytes 0-3/432965', 'Accept-Ranges':'bytes'
      }});
    },
    () => { throw new Error('backup should not be used'); }
  );
  const response = await worker.fetch(new Request(endpoint+'/demo.mp4?utm_source=chatgpt.com', {headers:{...originHeaders, Range:'bytes=0-3'}}));
  assert.equal(response.status,206);
  assert.equal(await response.text(),'demo');
  assert.equal(response.headers.get('Content-Type'),'video/mp4');
  assert.equal(response.headers.get('Content-Range'),'bytes 0-3/432965');
  assert.equal(response.headers.get('X-Cryalune-Video-Source'),'firebase');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),allowed);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://cryalune.firebaseapp.com/assets/cyralune-demo.mp4');
  assert.equal(calls[0].options.headers.get('Range'),'bytes=0-3');
});

test('uses the bundled clip when the Firebase request fails', async () => {
  const backupCalls = [];
  const worker = makeWorker(
    async () => new Response('unavailable', {status:503}),
    async (request) => {
      backupCalls.push(request);
      return new Response('backup', {status:200, headers:{'Content-Type':'video/mp4'}});
    }
  );
  const response = await worker.fetch(new Request(endpoint+'/demo.mp4', {headers:{Range:'bytes=0-3'}}));
  assert.equal(response.status,200);
  assert.equal(await response.text(),'backup');
  assert.equal(response.headers.get('X-Cryalune-Video-Source'),'bundled');
  assert.equal(backupCalls.length,1);
  assert.equal(backupCalls[0].url,endpoint+'/demo.mp4');
  assert.equal(backupCalls[0].headers.get('Range'),'bytes=0-3');
});

test('JJK test streams the fixed GitHub Release MP4 with seeking and CORS', async () => {
  const calls = [];
  const worker = makeWorker(
    async (url, options) => {
      calls.push({url, options});
      return new Response('chunk', {status:206, headers:{
        'Content-Type':'application/octet-stream',
        'Content-Range':'bytes 0-4/313070144',
        'Content-Length':'5',
        'Accept-Ranges':'bytes',
        'Content-Disposition':'attachment; filename="episode.mp4"'
      }});
    },
    () => { throw new Error('the JJK route must never use the demo fallback'); }
  );
  const response = await worker.fetch(new Request(endpoint+'/jjk-test.mp4', {
    headers:{...originHeaders, Range:'bytes=0-4'}
  }));
  assert.equal(response.status,206);
  assert.equal(await response.text(),'chunk');
  assert.equal(response.headers.get('Content-Type'),'video/mp4');
  assert.equal(response.headers.get('Content-Range'),'bytes 0-4/313070144');
  assert.equal(response.headers.get('Accept-Ranges'),'bytes');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),allowed);
  assert.equal(response.headers.get('X-Cryalune-Video-Source'),'github-release');
  assert.equal(response.headers.get('Content-Disposition'),null);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://github.com/RubyStation/cyralune/releases/download/jjk-test/Jujutsu.Kaisen.TV.Episode.1.mp4');
  assert.equal(calls[0].options.headers.get('Range'),'bytes=0-4');
  assert.equal(calls[0].options.redirect,'follow');
});

test('JJK HEAD and preflight work; unavailable releases fail cleanly', async () => {
  let upstreamRequests = 0;
  const worker = makeWorker(async (url, options) => {
    upstreamRequests++;
    if (options.method === 'HEAD')
      return new Response(null, {status:200, headers:{'Content-Type':'video/mp4','Content-Length':'313070144'}});
    return new Response('missing', {status:404});
  });
  const preflight = await worker.fetch(new Request(endpoint+'/jjk-test.mp4', {method:'OPTIONS',headers:originHeaders}));
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),allowed);
  assert.equal(upstreamRequests,0);
  const head = await worker.fetch(new Request(endpoint+'/jjk-test.mp4', {method:'HEAD'}));
  assert.equal(head.status,200);
  assert.equal(head.headers.get('Content-Length'),'313070144');
  assert.equal(await head.text(),'');
  const missing = await worker.fetch(new Request(endpoint+'/jjk-test.mp4'));
  assert.equal(missing.status,502);
  assert.match(await missing.text(),/JJK release source unavailable/);
  assert.equal(upstreamRequests,2);
});

test('demo refuses arbitrary URLs, foreign origins and methods', async () => {
  let forwarded = 0;
  const refuse = async () => { forwarded++; throw new Error('should not fetch'); };
  const worker = makeWorker(refuse, refuse);
  const cases = [
    [new Request(endpoint+'/demo.mp4?url=https://other.example'),404],
    [new Request(endpoint+'/anything.mp4'),404],
    [new Request(endpoint+'/jjk-test.mp4?source=https://other.example'),404],
    [new Request(endpoint+'/jjk-test.mp4', {headers:{Origin:'https://foreign.example'}}),403],
    [new Request(endpoint+'/jjk-test.mp4', {headers:{Range:'bytes=0-4,5-9'}}),400],
    [new Request(endpoint+'/demo.mp4', {headers:{Origin:'https://foreign.example'}}),403],
    [new Request(endpoint+'/demo.mp4', {method:'POST'}),405],
    [new Request(endpoint+'/demo.mp4', {headers:{Range:'bytes=0-4,5-9'}}),400]
  ];
  for (const [request,status] of cases) assert.equal((await worker.fetch(request)).status,status);
  assert.equal(forwarded,0);
});

test('health and CORS preflight work without fetching video', async () => {
  const worker = makeWorker(() => { throw new Error('unnecessary fetch'); }, () => { throw new Error('unnecessary backup'); });
  assert.match(await (await worker.fetch(new Request(endpoint+'/health'))).text(), /video demo ready/);
  const response = await worker.fetch(new Request(endpoint+'/demo.mp4',{method:'OPTIONS',headers:originHeaders}));
  assert.equal(response.status,204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),allowed);
});
