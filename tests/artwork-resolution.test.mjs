import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {SAVED_N7X_POSTER_COUNT,savedN7xPoster} from '../nyx-static/n7x-poster-catalog.js';
import {ANVIL_CATALOG} from '../nyx-static/anvil-catalog.js';
import {OFFLINE_ANIME} from '../nyx-static/offline-anime.js';

const posterDirectory = new URL('../nyx-static/assets/posters/',import.meta.url);

// Read each source JPEG's dimensions without resampling its pixels.
function jpegSize(bytes) {
  assert.equal(bytes[0],0xff);
  assert.equal(bytes[1],0xd8);
  let index = 2;
  while (index < bytes.length - 9) {
    if (bytes[index] !== 0xff) { index++; continue; }
    const marker = bytes[index+1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xff || marker === 0x00) { index++; continue; }
    if ([0xc0,0xc1,0xc2,0xc3].includes(marker))
      return [bytes.readUInt16BE(index+7),bytes.readUInt16BE(index+5)];
    const length = bytes.readUInt16BE(index+2);
    assert.ok(length >= 2);
    index += length + 2;
  }
  throw Error('No JPEG dimensions found');
}

test('all 105 original N7X posters are present with no enlarged variants', () => {
  const files = readdirSync(posterDirectory).filter(name => name.endsWith('.jpg'));
  assert.equal(files.length,105);
  assert.equal(SAVED_N7X_POSTER_COUNT,105);
  for (const filename of files) {
    const image = readFileSync(new URL(filename,posterDirectory));
    const [width,height] = jpegSize(image);
    assert.equal(width,342,`${filename} must keep the original 342px width`);
    assert.ok(height >= 450 && height <= 520,`${filename} has an unusual source height ${height}`);
  }
});

test('every available poster maps to a catalog title and uses the same detail image', () => {
  const items = [...ANVIL_CATALOG,...OFFLINE_ANIME];
  assert.equal(items.filter(item => Boolean(savedN7xPoster(item.name))).length,105);
  for (const item of items) {
    const expected = savedN7xPoster(item.name);
    if (!expected) {
      assert.equal(item.name,'Bleach: Thousand-Year Blood War');
      continue;
    }
    assert.equal(item.cover,expected);
    assert.equal(item.detailCover,expected);
  }
});
