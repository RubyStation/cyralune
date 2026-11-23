import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {OFFLINE_ANIME, searchOfflineAnime} from '../nyx-static/offline-anime.js';
import {ANVIL_CATALOG} from '../nyx-static/anvil-catalog.js';

test('offline discovery has 99 unique entries alongside the seven original Anvil entries', () => {
  assert.equal(ANVIL_CATALOG.length, 7);
  assert.equal(OFFLINE_ANIME.length, 99);
  assert.equal(new Set([...ANVIL_CATALOG, ...OFFLINE_ANIME].map(item => item.name.toLocaleLowerCase())).size, 106);
  assert.equal(new Set(OFFLINE_ANIME.map(item => item.id)).size, 99);
  for (const item of OFFLINE_ANIME) {
    assert.equal(item.type, 'anime');
    assert.equal('sources' in item, false);
  }
});

test('at least 40 anime have credited posters and named episodes available offline', () => {
  const enriched = OFFLINE_ANIME.filter(item => item.cover && item.episodeTitles.length);
  assert.ok(enriched.length >= 40, `Expected 40 fully sourced entries, got ${enriched.length}`);
  for (const item of enriched) {
    assert.match(item.cover, /^\.\/assets\/posters\/[a-z0-9-]+\.jpg$/);
    assert.ok(existsSync(new URL(`../nyx-static/${item.cover.slice(2)}`, import.meta.url)));
    assert.equal(item.detailCover, item.cover);
    const poster = readFileSync(new URL(`../nyx-static/${item.cover.slice(2)}`, import.meta.url));
    assert.equal(poster[0], 0xff);
    assert.equal(poster[1], 0xd8);
    assert.ok(poster.length > 1000);
    assert.ok(item.sourceUrl.startsWith('https://www.tvmaze.com/shows/'));
    assert.equal(item.episodes, item.episodeTitles.length);
    assert.ok(item.episodes >= 1 && item.episodes <= 300);
    assert.ok(item.episodeTitles.every(title => typeof title === 'string' && title.trim().length > 0));
  }
});

test('all but the unlisted Bleach continuation have an original-size N7X poster', () => {
  assert.deepEqual(OFFLINE_ANIME.filter(item => !item.cover).map(item => item.name),
    ['Bleach: Thousand-Year Blood War']);
});

test('offline entries remain searchable with no network', () => {
  assert.deepEqual(searchOfflineAnime('death note').map(item => item.name), ['Death Note']);
  assert.deepEqual(searchOfflineAnime('naruto').map(item => item.name),
    ['Naruto', 'Naruto: Shippuden', 'Boruto: Naruto Next Generations']);
});
