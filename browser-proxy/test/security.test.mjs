import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionCookie, isAllowedOrigin, isSessionValid, secureEquals, validateConfig } from '../security.mjs';
import { normalizeAddress } from '../public/address.js';

test('session has a bounded lifetime and never contains the access token', () => {
  const when = Date.UTC(2026, 10, 22);
  const cookie = createSessionCookie('an-example-high-entropy-secret', when, true);
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  assert.match(cookie, /; Secure$/);
  assert.doesNotMatch(cookie, /an-example-high-entropy-secret/);
  assert.equal(isSessionValid(cookie, 'an-example-high-entropy-secret', when), true);
  assert.equal(isSessionValid(cookie, 'different', when), false);
  assert.equal(isSessionValid(cookie, 'an-example-high-entropy-secret', when + 6 * 60 * 60 * 1000), false);
});

test('tampering and malformed session cookies are rejected', () => {
  const header = createSessionCookie('test-secret');
  assert.equal(isSessionValid(header.replace(/\.[a-f0-9]{64}/, '.' + '0'.repeat(64)), 'test-secret'), false);
  assert.equal(isSessionValid('relay_session=hello; HttpOnly', 'test-secret'), false);
  assert.equal(isSessionValid('', 'test-secret'), false);
  assert.equal(secureEquals('something', 'something'), true);
  assert.equal(secureEquals(null, 'something'), false);
});

test('only exact configured public or local origins are allowed', () => {
  assert.equal(isAllowedOrigin('http://localhost:8789', 'localhost:8789', ''), true);
  assert.equal(isAllowedOrigin('https://attacker.example', 'localhost:8789', ''), false);
  assert.equal(isAllowedOrigin('http://proxy.attacker.example', 'proxy.attacker.example', ''), false);
  assert.equal(isAllowedOrigin('https://relay.example', 'relay.example', 'https://relay.example'), true);
  assert.equal(isAllowedOrigin('https://relay.example.evil', 'relay.example', 'https://relay.example'), false);
});

test('remote exposure needs token and HTTPS', () => {
  assert.throws(() => validateConfig({ host: '0.0.0.0', token: '', publicOrigin: '' }), /PROXY_ACCESS_TOKEN/);
  assert.throws(() => validateConfig({ host: '0.0.0.0', token: 'secret', publicOrigin: '' }), /PUBLIC_ORIGIN/);
  assert.throws(() => validateConfig({ host: '0.0.0.0', token: 'secret', publicOrigin: 'http://proxy.example' }), /HTTPS/);
  assert.throws(() => validateConfig({ host: '0.0.0.0', token: 'secret', publicOrigin: 'https://proxy.example/path' }), /origin/);
  assert.doesNotThrow(() => validateConfig({ host: '0.0.0.0', token: 'secret', publicOrigin: 'https://proxy.example' }));
  assert.doesNotThrow(() => validateConfig({ host: '127.0.0.1', token: '', publicOrigin: '' }));
});

test('address bar uses HTTPS and rejects direct localhost', () => {
  assert.equal(normalizeAddress('example.com'), 'https://example.com/');
  assert.equal(normalizeAddress('https://example.com/path'), 'https://example.com/path');
  assert.equal(normalizeAddress('localhost:8080'), null);
  assert.equal(normalizeAddress(''), null);
  assert.equal(normalizeAddress('anime test'), 'https://www.google.com/search?q=anime%20test');
});
