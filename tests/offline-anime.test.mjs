import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFLINE_ANIME, searchOfflineAnime} from '../nyx-static/offline-anime.js';
import {ANVIL_CATALOG} from '../nyx-static/anvil-catalog.js';

test('offline discovery has 99 unique entries alongside the seven original Anvil entries', () => {
  assert.equal(ANVIL_CATALOG.length, 7);
  assert.equal(OFFLINE_ANIME.length, 99);
  assert.equal(new Set([...ANVIL_CATALOG, ...OFFLINE_ANIME].map(item => item.name.toLocaleLowerCase())).size, 106);
  assert.equal(new Set(OFFLINE_ANIME.map(item => item.id)).size, 99);
  for (const item of OFFLINE_ANIME) {
    assert.equal(item.type, 'anime');
    assert.equal(item.episodes, 0);
    assert.equal('sources' in item, false);
  }
});

test('offline entries remain searchable with no network', () => {
  assert.deepEqual(searchOfflineAnime('death note').map(item => item.name), ['Death Note']);
  assert.deepEqual(searchOfflineAnime('naruto').map(item => item.name),
    ['Naruto', 'Naruto: Shippuden', 'Boruto: Naruto Next Generations']);
});
