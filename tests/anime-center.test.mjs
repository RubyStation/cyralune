import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VERIFIED_SEASONS} from '../nyx-static/season-catalog.js';

const page = readFileSync(new URL('../nyx-static/studies.html',import.meta.url),'utf8');
const app = readFileSync(new URL('../nyx-static/app.js',import.meta.url),'utf8');
const theme = readFileSync(new URL('../nyx-static/quiet-theme.css',import.meta.url),'utf8');

test('Anime Center has a dedicated featured area and keeps the original search and pagination', () => {
  assert.match(page,/id="anime-feature"/);
  assert.match(page,/id="anime-search-form"/);
  assert.match(page,/id="anime-grid"/);
  assert.match(page,/id="anime-pagination"/);
});

test('featured Watch opens the existing episode player and poster cards open details', () => {
  assert.match(app,/data-action="feature-watch"/);
  assert.match(app,/if \(action === 'feature-watch'\)/);
  assert.match(app,/if \(selected\?\.episodes > 0\) openPlayer\(1\)/);
  assert.match(app,/class="anime-poster-card" data-action="detail"/);
  assert.doesNotMatch(app,/anime-episode-badge/);
});

test('featured and tile images crop without stretching and the poster grid adapts to mobile', () => {
  assert.match(theme,/\.anime-feature-image\s*\{[^}]*object-fit:cover/s);
  assert.match(theme,/\.anime-poster-card img\s*\{[^}]*object-fit:cover/s);
  assert.match(theme,/#anime-grid \{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(theme,/#anime-grid \{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('detail window restores season and episode dropdowns with Play and compact cards', () => {
  assert.match(page,/id="media-episode-grid"/);
  assert.match(page,/id="media-season"/);
  assert.match(page,/id="media-episode"/);
  assert.match(page,/id="media-play"/);
  assert.doesNotMatch(page,/id="media-season-count"/);
  assert.match(app,/data-media-select="\$\{episode\}"/);
  assert.match(app,/data-media-play="\$\{episode\}"/);
  assert.match(app,/data-media-mark="\$\{episode\}"/);
  assert.match(app,/\$\('#media-episode'\)\.addEventListener\('change'/);
  assert.match(app,/\$\('#media-play'\)\.addEventListener\('click'/);
  assert.match(theme,/\.media-episode-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(theme,/max-height:414px/);
  assert.ok(Object.keys(VERIFIED_SEASONS).length >= 50);
  assert.equal(VERIFIED_SEASONS.attackontitan[1].name,'Season 2');
});

test('artwork no longer uses the global grain overlay', () => {
  assert.match(theme,/body:before \{display:none\}/);
});
