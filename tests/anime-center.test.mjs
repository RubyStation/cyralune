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

test('featured artwork stays wide while original poster art fills the normal-size grid without distortion', () => {
  assert.match(theme,/\.anime-feature-image\s*\{[^}]*object-fit:cover/s);
  assert.match(theme,/\.anime-poster-card img\s*\{[^}]*object-fit:contain/s);
  assert.match(theme,/\.anime-poster-card\s*\{[^}]*aspect-ratio:2 \/ 3/s);
  assert.match(theme,/#anime-grid \{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(theme,/#anime-grid \{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(theme,/\.anime-poster-card\s*\{[^}]*max-width:160px/s);
  assert.match(app,/displayedAnime = items\.filter\(item => item\.type === 'anime'\)/);
  assert.doesNotMatch(app,/displayedAnime = visibleAnime\(/);
});

test('detail window keeps the classic season and episode dropdowns without episode cards', () => {
  assert.match(page,/id="media-episode-grid"/);
  assert.match(page,/id="media-season"/);
  assert.match(page,/id="media-episode"/);
  assert.match(page,/id="media-play"/);
  assert.doesNotMatch(page,/id="media-season-count"/);
  assert.doesNotMatch(app,/data-media-select="\$\{episode\}"/);
  assert.match(app,/\$\('#media-episode-grid'\)\.replaceChildren\(\)/);
  assert.match(app,/\$\('#media-episode'\)\.addEventListener\('change'/);
  assert.match(app,/\$\('#media-play'\)\.addEventListener\('click'/);
  assert.match(app,/\$\('#media-episode-grid'\)\.hidden = true/);
  assert.ok(Object.keys(VERIFIED_SEASONS).length >= 50);
  assert.equal(VERIFIED_SEASONS.attackontitan[1].name,'Season 2');
});

test('artwork no longer uses the global grain overlay', () => {
  assert.match(theme,/body:before \{display:none\}/);
});

test('JJK seasons have correct boundaries without external download links', () => {
  assert.deepEqual(VERIFIED_SEASONS.jujutsukaisen.map(group => [group.name,group.start,group.end]), [
    ['Season 1',1,24], ['Season 2',25,47], ['Season 3',48,59]
  ]);
  assert.doesNotMatch(page,/media-episode-external/);
  assert.doesNotMatch(app,/externalEpisodePage/);
});

test('navigation uses matching SVG icons and both search fields have aligned controls', () => {
  assert.match(page, /data-page="home"[^>]*><span class="nav-icon"[^>]*><svg/);
  assert.match(page, /data-page="settings"[^>]*><span class="nav-icon"[^>]*><svg/);
  assert.doesNotMatch(page, /<span>⌂<\/span>|<span>⚙<\/span>/);
  assert.match(page, /id="home-search-form"[\s\S]*?class="search-icon"[\s\S]*?id="home-query"/);
  assert.match(page, /id="anime-search-form"[\s\S]*?class="search-icon"[\s\S]*?id="anime-query"/);
  assert.match(theme, /\.home-search \.search-icon/);
  assert.match(theme, /\.anime-library-heading \.search-bar \.button/);
});

test('search never includes old discovery caches or network-only anime', () => {
  const from = app.indexOf('function uniqueAnime(');
  const to = app.indexOf('function loadAnime(', from);
  assert.ok(from >= 0 && to > from);
  const createSearch = new Function('ANVIL_CATALOG', 'OFFLINE_ANIME', 'data',
    app.slice(from,to) + '\nreturn {browseAnime, localAnime};');
  const {browseAnime, localAnime} = createSearch(
    [{id:'anime:jjk',name:'Jujutsu Kaisen',type:'anime',genre:'Action'}],
    [{id:'offline:naruto',name:'Naruto',type:'anime',genre:'Ninja'}],
    {titles:[{id:'custom:1',name:'My Custom Anime',type:'anime'}],
      animeCache:[{id:'anime:999',name:'Extra Ghost Series',type:'anime'}]});
  assert.deepEqual(browseAnime().map(item => item.name), ['Jujutsu Kaisen','My Custom Anime','Naruto']);
  assert.deepEqual(localAnime('ghost'), []);
  assert.deepEqual(localAnime('jujutsu').map(item => item.name), ['Jujutsu Kaisen']);
  assert.deepEqual(localAnime('custom').map(item => item.name), ['My Custom Anime']);
  assert.doesNotMatch(app, /const animeQuery =/);
  assert.doesNotMatch(app, /online = payload\.data\.Page\.media/);
});
