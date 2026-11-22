import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedTitle, restoreBannerCache} from '../nyx-static/banner-catalog.js';

test('saved widescreen images survive title-normalization differences and reloads', () => {
  const url = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/123.jpg';
  const result = restoreBannerCache({
    'Jujutsu Kaisen':url,
    'Attack on Titan':url,
    'Bad host':'https://untrusted.example/banner.jpg'
  });
  assert.equal(result.get(normalizedTitle('Jujutsu Kaisen')), url);
  assert.equal(result.get(normalizedTitle('Attack on Titan')), url);
  assert.equal(result.has(normalizedTitle('Bad host')), false);
  assert.equal(restoreBannerCache([]).size, 0);
});
