import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../nyx-static/studies.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../nyx-static/quiet-theme.css', import.meta.url), 'utf8');

test('home uses one flat ellipse, one dotted circle, and no glints', () => {
  const art = html.match(/<svg class="home-orbits"[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  assert.ok(art, 'home orbit artwork should be present');
  assert.equal((art.match(/<ellipse\b/g) || []).length, 1);
  assert.equal((art.match(/<circle\b/g) || []).length, 5);
  assert.doesNotMatch(art, /<(?:line|path|filter|radialGradient)\b/i);
  assert.match(css, /\.home-orbit-dotted\s*\{[^}]*stroke-dasharray:/);
  assert.match(css, /\.home-orbits\s*\{[^}]*width:min\(780px,94%\)/);
  assert.match(css, /body:has\(\.view\[data-view="home"\]:not\(\[hidden\]\)\)\s*\{\s*background:#030405;/);
});
