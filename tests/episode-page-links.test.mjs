import test from 'node:test';
import assert from 'node:assert/strict';
import {externalEpisodePage} from '../nyx-static/episode-page-links.js';

test('all 24 TokyoInsider Season 1 episode pages use their matching numbers', () => {
  const urls = Array.from({length:24},(_,index) => externalEpisodePage('anime:113415',index+1));
  assert.equal(new Set(urls).size,24);
  assert.equal(urls[0],'https://www.tokyoinsider.com/anime/J/Jujutsu_Kaisen_(TV)/episode/1');
  assert.equal(urls[23],'https://www.tokyoinsider.com/anime/J/Jujutsu_Kaisen_(TV)/episode/24');
  assert.ok(urls.every(url => url.startsWith('https://')));
});

test('external JJK download pages never masquerade as Season 2/3 or other show sources', () => {
  for (const episode of [0,25,47,48,59,60,1.5]) assert.equal(externalEpisodePage('anime:113415',episode),'');
  assert.equal(externalEpisodePage('offline:jujutsu-kaisen',1),'');
  assert.equal(externalEpisodePage('anvil:pokemon',1),'');
});
