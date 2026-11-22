import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const MAX_SESSION_SECONDS = 6 * 60 * 60;

export function secureEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const first = createHash('sha256').update(a).digest();
  const second = createHash('sha256').update(b).digest();
  return timingSafeEqual(first, second);
}

function signature(expiration, key) {
  return createHmac('sha256', key).update(`cryalune-wisp-session-v1:${expiration}`).digest('hex');
}

export function createSessionCookie(key, now = Date.now(), secure = false) {
  if (!key) throw new Error('Session signing key is required');
  const expiration = Math.floor(now / 1000) + MAX_SESSION_SECONDS;
  const value = `${expiration}.${signature(expiration, key)}`;
  return `relay_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

export function isSessionValid(cookieHeader, key, now = Date.now()) {
  if (!key || !cookieHeader) return false;
  const value = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('relay_session='))?.slice('relay_session='.length);
  if (!value) return false;
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const expiry = Number(match[1]);
  const current = Math.floor(now / 1000);
  if (expiry <= current || expiry > current + MAX_SESSION_SECONDS) return false;
  return secureEquals(match[2], signature(expiry, key));
}

export function isAllowedOrigin(origin, host, publicOrigin) {
  if (!origin) return false;
  if (publicOrigin) return origin === publicOrigin;
  if (!/^((localhost|127\.0\.0\.1)(:\d{1,5})?)$/i.test(host ?? '')) return false;
  return origin === `http://${host}`;
}

export function validateConfig({ host, token, publicOrigin }) {
  if (host !== '127.0.0.1' && host !== 'localhost' && !token) {
    throw new Error('Set PROXY_ACCESS_TOKEN before binding to a public interface.');
  }
  if (host !== '127.0.0.1' && host !== 'localhost' && !publicOrigin) {
    throw new Error('Set HTTPS PUBLIC_ORIGIN before binding to a public interface.');
  }
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (url.origin !== publicOrigin || !['https:', 'http:'].includes(url.protocol)) {
      throw new Error('PUBLIC_ORIGIN must be an origin, not a path or query.');
    }
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('A public proxy requires HTTPS.');
    }
  }
}
