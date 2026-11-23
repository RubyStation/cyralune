import test from 'node:test';
import assert from 'node:assert/strict';
import {ANVIL_CATALOG, JJK_EPISODES, searchAnvilCatalog} from '../nyx-static/anvil-catalog.js';

test('the complete seven-title Anvil library is available without an API', () => {
  assert.equal(ANVIL_CATALOG.length, 7);
  assert.deepEqual(ANVIL_CATALOG.map(item => item.name), [
    'Jujutsu Kaisen', 'Pokémon', 'One Piece', 'Doraemon',
    'Chibi Maruko-chan', 'Detective Conan', 'Ninja Boy Rantaro'
  ]);
  assert.equal(searchAnvilCatalog('').length, 7);
});

test('Jujutsu Kaisen preserves its Firebase ID and original names across all three seasons', () => {
  assert.equal(ANVIL_CATALOG[0].id, 'anime:113415');
  assert.equal(ANVIL_CATALOG[0].episodes, 59);
  assert.equal(JJK_EPISODES.length, 59);
  assert.equal(JJK_EPISODES[0], 'Ryomen Sukuna');
  assert.equal(JJK_EPISODES[23], 'Accomplices');
  assert.equal(JJK_EPISODES[24], 'Hidden Inventory');
  assert.equal(JJK_EPISODES[46], 'The Shibuya Incident - Gate Closed');
  assert.equal(JJK_EPISODES[47], 'Execution');
  assert.equal(JJK_EPISODES[51], 'Passion');
  assert.equal(JJK_EPISODES[53], 'Tokyo No. 1 Colony, Part 1');
  assert.equal(JJK_EPISODES[58], 'Sendai Colony');
});

test('built-in search works by name, genre, and year even offline', () => {
  assert.deepEqual(searchAnvilCatalog('doraemon').map(item => item.name), ['Doraemon']);
  assert.deepEqual(searchAnvilCatalog('Mystery').map(item => item.name), ['Detective Conan']);
  assert.deepEqual(searchAnvilCatalog('adventure 1999').map(item => item.name), ['One Piece']);
  assert.deepEqual(searchAnvilCatalog('NOT A SHOW'), []);
});

test('the imported metadata does not contain any private video sources', () => {
  for (const item of ANVIL_CATALOG) {
    assert.equal('sources' in item, false);
    assert.equal('editorCode' in item, false);
  }
});
