import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../nyx-static/studies.html',import.meta.url),'utf8');
const theme = readFileSync(new URL('../nyx-static/quiet-theme.css',import.meta.url),'utf8');

test('liquid-glass panels preserve the dark theme and have a low-data fallback', () => {
  assert.match(theme,/\.glass\s*\{[^}]*rgba\(45,49,59,\.72\)[^}]*backdrop-filter:blur\(13px\)/s);
  assert.match(theme,/\.video-tabs,\.search-bar,\.home-search,\.anime-library-heading \.search-bar/);
  assert.match(theme,/html\.low-data-mode \.glass[\s\S]*?backdrop-filter:none/);
});

test('page changes animate into view without hiding content or delaying navigation', () => {
  assert.match(theme,/\.view:not\(\[hidden\]\)\s*\{[^}]*animation:cr-view-enter/);
  assert.match(theme,/@keyframes cr-view-enter/);
  assert.match(theme,/@media\(prefers-reduced-motion:reduce\)\s*\{\s*\.view:not\(\[hidden\]\) \{animation:none\}/);
});

test('animated selection follows the existing accessible nav links on desktop and mobile', () => {
  for (const name of ['home','videos','settings']) {
    assert.match(page,new RegExp(`href="#${name}" data-page="${name}"`));
  }
  assert.match(theme,/#nav:has\(> a\[data-page="videos"\]\.active\)::before \{transform:translateY\(68px\)\}/);
  assert.match(theme,/#nav:has\(> a\[data-page="settings"\]\.active\)::before \{transform:translateY\(136px\)\}/);
  assert.match(theme,/#nav:has\(> a\[data-page="settings"\]\.active\)::before \{transform:translateX\(calc\(200% \+ 4px\)\)\}/);
});

test('cinematic poster hover respects full-sized images, keyboard focus and reduced motion', () => {
  assert.match(theme,/\.anime-poster-card img\s*\{[^}]*object-fit:contain/s);
  assert.match(theme,/@media\(hover:hover\) and \(pointer:fine\)\s*\{/);
  assert.match(theme,/\.anime-poster-card:hover img \{transform:scale\(1\.035\)\}/);
  assert.match(theme,/\.anime-poster-card:focus-visible \{/);
  assert.match(theme,/\.anime-poster-card:focus-visible \{transform:none\}/);
  assert.match(page,/<svg class="home-orbits"/);
});
