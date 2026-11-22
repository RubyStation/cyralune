import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

function rawStatus(origin, rawPath) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL(origin), { path: rawPath }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
    request.end();
  });
}

async function withServer(token, action) {
  const port = 22000 + Math.floor(Math.random() * 10000);
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), LISTEN_HOST: '127.0.0.1', PROXY_ACCESS_TOKEN: token, PUBLIC_ORIGIN: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errorOutput = '';
  child.stderr.on('data', (buffer) => { errorOutput += buffer.toString(); });
  try {
    let up = false;
    for (let attempt = 0; attempt < 70; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Proxy server exited: ${errorOutput}`);
      try {
        const health = await fetch(`${origin}/health`);
        if (health.ok) { up = true; break; }
      } catch { /* server not ready yet */ }
      await delay(100);
    }
    if (!up) throw new Error(`Proxy server did not start: ${errorOutput}`);
    await action(origin);
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), delay(1500)]);
  }
}

test('serves the actual Scramjet and Wisp browser assets', { timeout: 12000 }, async () => {
  await withServer('', async (origin) => {
    for (const path of ['/', '/sw.js', '/app.js', '/scram/scramjet.all.js', '/baremux/worker.js', '/libcurl/index.mjs']) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 200, `Asset ${path} did not load`);
      await response.body?.cancel();
    }
    const notFound = await fetch(`${origin}/missing`);
    assert.equal(notFound.status, 404);
  });
});

test('remote token mode blocks anonymous files and websocket upgrades', { timeout: 12000 }, async () => {
  await withServer('long-example-secret-for-tests', async (origin) => {
    const anonymous = await fetch(origin, { redirect: 'manual' });
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('location'), '/login');

    // Send raw paths: fetch(URL) would normalize the dot segments before dispatch.
    for (const unsafePath of ['/prefix/../sw.js', '/prefix/%2e%2e/sw.js', '/./sw.js', '//sw.js']) {
      const code = await rawStatus(origin, unsafePath);
      assert.notEqual(code, 200, `Anonymous static file exposed through ${unsafePath}`);
    }

    const badOrigin = await fetch(`${origin}/login`, {
      method: 'POST', headers: { Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=long-example-secret-for-tests', redirect: 'manual',
    });
    assert.equal(badOrigin.status, 403);

    const proxyRewrittenOrigin = await fetch(`${origin}/login`, {
      method: 'POST', headers: { Origin: 'https://preview-intermediary.example', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=long-example-secret-for-tests', redirect: 'manual',
    });
    assert.equal(proxyRewrittenOrigin.status, 302);

    const login = await fetch(`${origin}/login`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=long-example-secret-for-tests', redirect: 'manual',
    });
    assert.equal(login.status, 302);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /^relay_session=/);

    const asset = await fetch(`${origin}/sw.js`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(asset.status, 200);
    await asset.body.cancel();

    const noCookieSocket = new WebSocket(`${origin.replace('http:', 'ws:')}/wisp/`, { origin });
    noCookieSocket.on('error', () => {});
    const [, rejected] = await once(noCookieSocket, 'unexpected-response');
    assert.equal(rejected.statusCode, 403);
    rejected.resume();

    const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/wisp/`, { origin, headers: { Cookie: cookie.split(';')[0] } });
    await once(socket, 'open');
    assert.equal(socket.readyState, WebSocket.OPEN);
    socket.close();
  });
});
