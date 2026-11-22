import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyFormbody from '@fastify/formbody';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { createSessionCookie, isAllowedOrigin, isSessionValid, secureEquals, validateConfig } from './security.mjs';

const host = process.env.LISTEN_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8789);
const accessToken = process.env.PROXY_ACCESS_TOKEN || '';
const publicOrigin = process.env.PUBLIC_ORIGIN || '';
validateConfig({ host, token: accessToken, publicOrigin });
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');

// A Wisp socket is a general TCP tunnel. Never expose it unauthenticated.
logging.set_level(logging.WARN);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  allow_direct_ip: false,
  allow_private_ips: false,
  allow_loopback_ips: false,
  port_whitelist: [80, 443],
  stream_limit_per_host: 6,
  stream_limit_total: 16,
  hostname_blacklist: [/(^|\.)(localhost|local|internal|test|invalid)$/i, /(^|\.)metadata\.google\.internal$/i],
});

const failedLogins = new Map();
const loginWindowMs = 15 * 60 * 1000;
const loginLimit = 5;

function isAuthenticated(request) {
  return !accessToken || isSessionValid(request.headers.cookie, accessToken);
}

function clientMayLogin(ip) {
  const now = Date.now();
  const entry = failedLogins.get(ip);
  if (!entry || now > entry.until) {
    failedLogins.delete(ip);
    return true;
  }
  return entry.count < loginLimit;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = failedLogins.get(ip);
  if (!entry || now > entry.until) failedLogins.set(ip, { count: 1, until: now + loginWindowMs });
  else entry.count += 1;
  // Bound the memory footprint on long-running instances.
  if (failedLogins.size > 1000) failedLogins.delete(failedLogins.keys().next().value);
}

function rejectSocket(socket, status = '403 Forbidden') {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

const app = Fastify({
  trustProxy: false,
  bodyLimit: 4096,
  serverFactory: (handler) => createServer((req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    handler(req, res);
  }).on('upgrade', (req, socket, head) => {
    const path = req.url?.split('?')[0];
    if (path !== '/wisp/' || !isAllowedOrigin(req.headers.origin, req.headers.host, publicOrigin) || !isAuthenticated(req)) {
      rejectSocket(socket);
      return;
    }
    wisp.routeRequest(req, socket, head);
  }),
});

await app.register(fastifyFormbody);

app.addHook('onRequest', async (request, reply) => {
  if (!publicOrigin && host === '127.0.0.1' && !/^(localhost|127\.0\.0\.1):\d{1,5}$/i.test(request.headers.host ?? '')) {
    return reply.code(403).send('Invalid host');
  }
  if (request.url === '/health' || request.url === '/login' || isAuthenticated(request)) return;
  if (request.method === 'GET' && (request.url === '/' || request.headers.accept?.includes('text/html'))) {
    return reply.redirect('/login');
  }
  return reply.code(401).send('Sign in required');
});

app.get('/health', async () => ({ service: 'cryalune-wisp-browser', status: 'ready' }));

app.get('/login', async (_request, reply) => reply.type('text/html').send(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relay sign-in</title>
<style>body{font:16px system-ui;background:#101522;color:#e9e6ee;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#1b2334;border:1px solid #56617d;padding:2rem;border-radius:18px;max-width:350px;width:80vw}input,button{box-sizing:border-box;padding:.85rem;width:100%;margin-top:.8rem;border:1px solid #7483a5;border-radius:9px;background:#11192b;color:white}button{background:#7974bc;cursor:pointer}</style>
<main><h1>Private browser relay</h1><p>Enter your access token to open the local proxy.</p><form method="POST" action="/login"><input type="password" name="token" required autocomplete="current-password" aria-label="Access token"><button type="submit">Sign in</button></form></main></html>`));

app.post('/login', { config: { rateLimit: false } }, async (request, reply) => {
  if (!accessToken) return reply.redirect('/');
  if (!isAllowedOrigin(request.headers.origin, request.headers.host, publicOrigin)) {
    return reply.code(403).send('Invalid request origin');
  }
  const ip = request.ip;
  if (!clientMayLogin(ip)) return reply.code(429).send('Too many attempts. Wait 15 minutes.');
  const provided = typeof request.body?.token === 'string' ? request.body.token : null;
  if (!secureEquals(provided, accessToken)) {
    recordFailedLogin(ip);
    return reply.code(401).send('Incorrect token');
  }
  failedLogins.delete(ip);
  reply.header('Set-Cookie', createSessionCookie(accessToken, Date.now(), publicOrigin.startsWith('https://')));
  return reply.redirect('/');
});

app.post('/logout', async (request, reply) => {
  if (!isAllowedOrigin(request.headers.origin, request.headers.host, publicOrigin)) return reply.code(403).send('Invalid origin');
  reply.header('Set-Cookie', 'relay_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');
  return reply.redirect('/login');
});

const publicPath = fileURLToPath(new URL('./public/', import.meta.url));
await app.register(fastifyStatic, { root: publicPath, decorateReply: true });
await app.register(fastifyStatic, { root: scramjetPath, prefix: '/scram/', decorateReply: false });
await app.register(fastifyStatic, { root: baremuxPath, prefix: '/baremux/', decorateReply: false });
await app.register(fastifyStatic, { root: libcurlPath, prefix: '/libcurl/', decorateReply: false });

app.setNotFoundHandler((_request, reply) => reply.code(404).send('Not found'));

await app.listen({ port, host });
console.log(`Private browser proxy listening at http://${host}:${port}`);
console.log(accessToken ? 'Access token required.' : 'LOCAL-ONLY MODE: set PROXY_ACCESS_TOKEN before exposing the service.');

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => { app.close().finally(() => process.exit(0)); });
}
