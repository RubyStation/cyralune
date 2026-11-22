import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {LOCAL_BANNERS} from '../nyx-static/local-banner-catalog.js';
import {normalizedTitle} from '../nyx-static/banner-catalog.js';
import {ANIME_GALLERY} from '../nyx-static/anime-gallery.js';
import {ANVIL_CATALOG} from '../nyx-static/anvil-catalog.js';

const allShows = [...ANIME_GALLERY, ...ANVIL_CATALOG];
const slug = name => name.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function dimensions(file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.toString('ascii',0,4), 'RIFF');
  assert.equal(bytes.toString('ascii',8,12), 'WEBP');
  // WebP's native VP8 bitstream stores its true canvas dimensions directly.
  assert.equal(bytes.toString('ascii',12,16), 'VP8 ');
  assert.equal(bytes.toString('hex',23,26), '9d012a');
  return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
}

test('local widescreen banners are authentic landscape files at least 1880 pixels wide', () => {
  const entries = Object.entries(LOCAL_BANNERS);
  assert.ok(entries.length >= 50, `Expected at least 50 sourced widescreen backgrounds; found ${entries.length}`);
  const known = new Set(allShows.map(show => normalizedTitle(show.name)));
  for (const [key,url] of entries) {
    assert.ok(known.has(key), `Unrecognized anime key ${key}`);
    assert.match(url, /^\.\/assets\/banners\/[a-z0-9-]+\.webp$/);
    const file = new URL(`../nyx-static/${url.slice(2)}`, import.meta.url);
    assert.ok(existsSync(file), `${key} has no local artwork file`);
    const [width,height] = dimensions(file.pathname);
    assert.ok(width >= 1880, `${key} image is only ${width}px wide`);
    assert.ok(width/height >= 1.5, `${key} image is not widescreen`);
  }
});

test('qualifying poster files retain real full-size detail rather than being enlarged from thumbnails', () => {
  let highResolution = 0;
  for (const show of allShows) {
    const file = new URL(`../nyx-static/assets/posters-hd/${slug(show.name)}.webp`, import.meta.url);
    const [width] = dimensions(file.pathname);
    if (width >= 1880) highResolution++;
  }
  assert.ok(highResolution >= 30, `Only ${highResolution} source posters are at least 1880px wide`);
});
