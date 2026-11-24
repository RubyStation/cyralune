import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../nyx-static/studies.html',import.meta.url),'utf8');
const png = readFileSync(new URL('../nyx-static/assets/new-tab-official-dark.png',import.meta.url));
const original = readFileSync(new URL('../nyx-static/assets/new-tab-official.png',import.meta.url));

test('New Tab uses the original Chromium NTP favicon artwork for dark mode', () => {
  assert.match(page,/<title>New Tab<\/title>/);
  assert.match(page,/rel="icon" type="image\/png" sizes="32x32" href="\.\/assets\/new-tab-official-dark\.png\?v=3"/);
  for (const image of [png,original]) {
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16),32);
    assert.equal(image.readUInt32BE(20),32);
  }
});
