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

test('Jujutsu Kaisen keeps the original Firebase ID and 24 Anvil episode names', () => {
  assert.equal(ANVIL_CATALOG[0].id, 'anime:113415');
  assert.equal(ANVIL_CATALOG[0].episodes, 24);
  assert.equal(JJK_EPISODES.length, 24);
  assert.equal(JJK_EPISODES[0], 'Ryomen Sukuna');
  assert.equal(JJK_EPISODES[23], 'Accomplices');
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
