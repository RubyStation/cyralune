import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ANVIL_CATALOG} from '../nyx-static/anvil-catalog.js';

test('all original Anvil shows have local credited posters and HD fallbacks', () => {
  for (const item of ANVIL_CATALOG) {
    assert.match(item.cover, /^\.\/assets\/posters\/[a-z0-9-]+\.jpg$/);
    assert.match(item.detailCover, /^\.\/assets\/posters-hd\/[a-z0-9-]+\.webp$/);
    assert.match(item.sourceUrl, /^https:\/\/www\.tvmaze\.com\/shows\/[0-9]+\//);
    const jpg = readFileSync(new URL(`../nyx-static/${item.cover.slice(2)}`, import.meta.url));
    const webp = readFileSync(new URL(`../nyx-static/${item.detailCover.slice(2)}`, import.meta.url));
    assert.equal(jpg[0], 0xff);
    assert.equal(jpg[1], 0xd8);
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
    assert.ok(jpg.length > 1000 && webp.length > 1000);
  }
});
