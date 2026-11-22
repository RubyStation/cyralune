import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

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
