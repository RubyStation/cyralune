import test from 'node:test';
import assert from 'node:assert/strict';
import {safeUrl, cleanText, escapeHtml, normalizedSource, sortedSources,
  defaultData, restoreData, progressKey} from '../dist/core.js';

if (!globalThis.crypto) globalThis.crypto = {randomUUID: () => 'test-uuid'};

test('URLs require HTTPS and reject credential-bearing links', () => {
  assert.equal(safeUrl('https://example.org/video.mp4'), 'https://example.org/video.mp4');
  assert.equal(safeUrl('http://example.org'), null);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://user:password@example.org'), null);
  assert.equal(safeUrl('/_theme/demo.mp4'), null);
  assert.equal(safeUrl('', {allowEmpty: true}), '');
});

test('text is bounded and escaped for HTML output', () => {
  assert.equal(cleanText('  Hello Moon  ', 5), 'Hello');
  assert.equal(escapeHtml(`<img src="x" onerror='bad'>`), '&lt;img src=&quot;x&quot; onerror=&#39;bad&#39;&gt;');
});

test('sources validate type, priority and optional captions', () => {
  const source = normalizedSource({id:'s1', name:'Direct', type:'mp4',
    url:'https://cdn.example.org/movie.mp4', captions:'', priority:7});
  assert.deepEqual(source, {id:'s1', name:'Direct', type:'mp4',
    url:'https://cdn.example.org/movie.mp4', captions:'', priority:7});
  assert.equal(normalizedSource({...source, type:'javascript'}), null);
  assert.equal(normalizedSource({...source, priority:-1}), null);
  assert.equal(normalizedSource({...source, captions:'http://invalid.test/test.vtt'}), null);
  assert.equal(normalizedSource({...source, url:'http://invalid.test/movie.mp4'}), null);
});

test('source priority sorts ascending without changing input', () => {
  const sources = [{name:'Backup', priority:10}, {name:'Primary', priority:1}];
  assert.deepEqual(sortedSources(sources).map(x => x.name), ['Primary', 'Backup']);
  assert.equal(sources[0].name, 'Backup');
});

test('invalid backup fields are constrained when restored', () => {
  const data = restoreData({lastPage:'bad', accent:'red', favorites:[3,'anime:113415'],
    websites:[{name:'Insecure', url:'http://bad.test'}, {name:'Valid',url:'https://example.org'}],
    sources:{'anime:113415:e1':[{name:'Valid',type:'hls',url:'https://example.org/main.m3u8',priority:2},
      {name:'Invalid',type:'mp4',url:'javascript:run()'}]}});
  assert.equal(data.lastPage, 'home');
  assert.equal(data.accent, defaultData().accent);
  assert.deepEqual(data.favorites, ['anime:113415']);
  assert.equal(data.websites.length, 1);
  assert.equal(data.sources['anime:113415:e1'].length, 1);
  assert.equal(progressKey('anime:113415', 2), 'anime:113415:e2');
});
