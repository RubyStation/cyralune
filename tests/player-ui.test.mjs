import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';

const html = readFileSync(new URL('../nyx-static/studies.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../nyx-static/app.js', import.meta.url), 'utf8');

test('new player controls all have live event handlers', () => {
  for (const id of ['player-speed', 'player-quality', 'player-audio', 'player-auto-next',
    'player-skip-back', 'player-skip-forward']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.ok(script.includes(`$('#${id}').addEventListener(`), `${id} has no handler`);
  }
});

test('HLS client is bundled on our own origin for restricted networks', () => {
  assert.ok(statSync(new URL('../nyx-static/assets/vendor/hls.min.js', import.meta.url)).size > 300000);
  assert.ok(statSync(new URL('../nyx-static/assets/vendor/hls.LICENSE', import.meta.url)).size > 500);
  assert.ok(script.includes("script.src = './assets/vendor/hls.min.js'"));
  assert.ok(script.includes('Hls.Events.MANIFEST_PARSED'));
});

test('temporary Chromebook clip has an explicit sound control', () => {
  assert.match(html, /id="temporary-test-sound"/);
  assert.match(html, /id="temporary-test-video"/);
  assert.ok(script.includes("$('#temporary-test-sound').addEventListener("));
  assert.ok(script.includes('clip.muted = false'));
  assert.ok(script.includes('clip.volume = 1'));
  assert.ok(statSync(new URL('../nyx-static/assets/temporary-chromebook-test.mp4', import.meta.url)).size > 1000000);
});

test('privacy notice and policy links are absent from the page', () => {
  assert.doesNotMatch(html, /privacy-notice|privacy-open|privacy-footer|Privacy &amp; attribution/);
});
