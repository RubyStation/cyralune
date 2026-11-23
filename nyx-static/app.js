import {STORAGE_KEY, safeUrl, cleanText, escapeHtml, normalizedSource, sortedSources, defaultData, restoreData, progressKey, neighboringEpisode, nextPlayableSource, episodeGroups, PLAYBACK_SPEEDS} from './core.js';
import {ANVIL_CATALOG, searchAnvilCatalog} from './anvil-catalog.js';
import {OFFLINE_ANIME, searchOfflineAnime} from './offline-anime.js';
import {PUBLISHED_SOURCES} from './published-sources.js';
import {BANNER_CACHE_KEY, normalizedTitle, bannerQuery, verifiedBanner, restoreBannerCache} from './banner-catalog.js';
import {LOCAL_BANNERS} from './local-banner-catalog.js';
import {VERIFIED_SEASONS} from './season-catalog.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let data;
try { data = restoreData(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
catch { data = defaultData(); }
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { status('Browser storage is full. Export a backup from Settings.', true); } };
const catalog = new Map();
const demo = {id:'demo:001', name:'The Lunar Test Reel', type:'movie', episodes:1, description:'An original short test video with sound and subtitles.', format:'Original short'};
function seedCatalog() {
  catalog.clear(); catalog.set(demo.id, demo);
  for (const item of ANVIL_CATALOG) catalog.set(item.id, item);
  for (const item of data.animeCache) if (!ANVIL_CATALOG.some(saved => saved.id === item.id)) catalog.set(item.id, item);
  // Source-checked guides override stale metadata cached in older browser sessions.
  for (const item of OFFLINE_ANIME) catalog.set(item.id, item);
}
seedCatalog();
for (const title of data.titles) catalog.set(title.id, title);

let selected = null, selectedEpisode = 1, currentSource = null, activeSources = [], activeIndex = -1;
let localVideoUrl = '', localCaptionUrl = '', hls = null, searchSerial = 0, lastSavedSecond = -1;
let hlsLibraryPromise = null, pendingAutoplay = false;
let activeVideoTab = 'anime', lastRenderedPage = '', detailReturnPage = 'videos', detailReturnTab = 'anime';
const video = $('#video');
const embed = $('#embed');
video.volume = data.playerVolume;
video.playbackRate = data.playbackSpeed;
$('#player-speed').value = String(data.playbackSpeed);
$('#player-auto-next').checked = data.autoNext;
const wideBanners = new Map();
try {
  const cached = JSON.parse(localStorage.getItem(BANNER_CACHE_KEY) || '{}');
  for (const [key, url] of restoreBannerCache(cached)) wideBanners.set(key, url);
} catch { /* An unavailable cache never prevents the collection from opening. */ }
const missingWideBanners = new Set();
const pendingWideBanners = new Map();
let bannerWorker = null, bannerLookupUnavailable = false;

function wideBanner(item) {
  if (!item) return '';
  const key = normalizedTitle(item.name);
  return LOCAL_BANNERS[key] || wideBanners.get(key) || verifiedBanner(item.name, {title:{english:item.name},bannerImage:item.banner}) || '';
}

function rememberWideBanner(name, url) {
  const key = normalizedTitle(name);
  if (!key || !url) return;
  wideBanners.set(key,url);
  try { localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(Object.fromEntries(wideBanners))); }
  catch { /* Artwork still works for this browser session. */ }
}

function heroArtwork(item) {
  if (!item || data.lowDataMode) return [];
  const banner = wideBanner(item);
  // Never stretch a 342px-wide poster into the cinematic banner slot.
  return banner ? [{url: banner, portrait: false}] : [];
}

function findWideBanners(items) {
  if (data.lowDataMode || bannerLookupUnavailable) return;
  for (const item of items) {
    if (item.type !== 'anime' || wideBanner(item)) continue;
    const key = normalizedTitle(item.name);
    if (key && !missingWideBanners.has(key) && !pendingWideBanners.has(key)) pendingWideBanners.set(key,item);
  }
  if (!bannerWorker && pendingWideBanners.size) {
    bannerWorker = resolveWideBanners().finally(() => {
      bannerWorker = null;
      renderAnime(animeResults);
    });
  }
}

async function resolveWideBanners() {
  while (pendingWideBanners.size && !data.lowDataMode) {
    const batch = [...pendingWideBanners.entries()].slice(0, 12);
    for (const [key] of batch) pendingWideBanners.delete(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9500);
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method:'POST', signal:controller.signal, headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({query:bannerQuery(batch.map(([,item]) => item.name))})
      });
      if (!response.ok) throw Error(`Banner lookup returned ${response.status}`);
      const payload = await response.json();
      if (!payload?.data) throw Error('Banner data is unavailable');
      batch.forEach(([key,item],index) => {
        const url = verifiedBanner(item.name,payload.data[`b${index}`],item.year);
        if (url) rememberWideBanner(item.name,url);
        else missingWideBanners.add(key);
      });
      $('#retry-banners').hidden = true;
      renderAnime(animeResults);
      renderHomeProgress();
      renderFavorites();
    } catch {
      bannerLookupUnavailable = true;
      $('#retry-banners').hidden = false;
      pendingWideBanners.clear();
      $('#anime-status').textContent = 'Widescreen artwork is unavailable. Showing saved anime from the local catalog.';
      if (animeResults.length) renderAnime(animeResults);
      break;
    } finally { clearTimeout(timeout); }
  }
}

function status(message, error = false) {
  const el = $('#player-dialog').open ? $('#player-status') : $('#anime-status');
  el.textContent = message; el.classList.toggle('error', error);
}

function applyAccent() { document.documentElement.style.setProperty('--accent', data.accent); $('#accent-input').value = data.accent; }
function applyPreferences() {
  document.documentElement.classList.toggle('low-data-mode', data.lowDataMode);
  $('#low-data-mode').checked = data.lowDataMode;
  $('#player-dialog').classList.toggle('cinema-mode', data.cinemaMode);
  $('#cinema-mode').setAttribute('aria-pressed', String(data.cinemaMode));
  $('#cinema-mode').textContent = data.cinemaMode ? 'Exit Cinema Mode' : 'Cinema Mode';
}
applyAccent();
applyPreferences();

const legacyVideoTabs = {anime: 'anime', movies: 'movies', shows: 'shows', list: 'favorites', favorites: 'favorites', test: 'test'};
const videoTabContent = {
  anime: ['Anime', 'Explore the original Anvil titles and a larger offline anime discovery index.'],
  movies: ['Movies', 'Your films and their available sources.'],
  shows: ['TV Shows', 'Keep every series and episode together.'],
  favorites: ['My Favorites', 'Titles you have saved to return to later.'],
  test: ['Playback Test', 'Temporary Chromebook video and audio compatibility test.']
};
function selectVideoTab(tab) {
  if (!Object.hasOwn(videoTabContent, tab)) tab = 'anime';
  if (tab !== 'test') $('#temporary-test-video').pause();
  activeVideoTab = tab;
  const [heading, description] = videoTabContent[tab];
  $('#videos-heading').textContent = heading;
  $('#videos-description').textContent = description;
  $$('[data-video-tab]').forEach(button => {
    const active = button.dataset.videoTab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $$('[data-video-pane]').forEach(pane => { pane.hidden = pane.dataset.videoPane !== tab; });
}

function pageRoute() {
  let page = location.hash.replace('#', '') || data.lastPage;
  const legacyTab = legacyVideoTabs[page];
  if (legacyTab) { activeVideoTab = legacyTab; page = 'videos'; }
  if (page === 'detail' && !selected) page = 'videos';
  if (!$(`[data-view="${page}"]`)) page = 'home';
  if (page !== 'videos') $('#temporary-test-video').pause();
  $$('.view').forEach(element => element.hidden = element.dataset.view !== page);
  $$('#nav a').forEach(element => { const active = element.dataset.page === page; element.classList.toggle('active', active); if (active) element.setAttribute('aria-current', 'page'); else element.removeAttribute('aria-current'); });
  if (page !== 'detail') { data.lastPage = page; save(); }
  if (page === 'home') renderHomeProgress();
  if (page === 'videos') {
    // Opening Videos normally starts with Anime; returning from a title keeps its tab.
    if (!legacyTab && lastRenderedPage !== 'detail') activeVideoTab = 'anime';
    selectVideoTab(activeVideoTab);
    renderLocalTitles(); renderFavorites();
  }
  lastRenderedPage = page;
  window.scrollTo({top: 0, behavior: 'instant'});
}
window.addEventListener('hashchange', pageRoute);

function trustedCover(raw) {
  if (typeof raw === 'string' && /^\.\/assets\/posters(?:-hd)?\/[a-z0-9-]+\.(?:jpg|webp)$/.test(raw)) return raw;
  return safeUrl(raw || '', {allowEmpty:true}) || '';
}

function itemCard(item) {
  const name = escapeHtml(item.name), format = escapeHtml(item.format || (item.type === 'tv' ? 'TV series' : item.type === 'anime' ? 'Anime' : 'Movie'));
  const thumbnail = data.lowDataMode ? '' : trustedCover(item.cover);
  const hd = data.lowDataMode ? '' : trustedCover(item.detailCover);
  // A 1x screen used to pick the old small thumbnail from srcset, so the HD
  // replacements appeared to do nothing. Always display the genuine HD source.
  const url = hd || thumbnail;
  const fallback = hd && thumbnail && hd !== thumbnail ? ` data-fallback="${escapeHtml(thumbnail)}"` : '';
  const poster = `<span class="poster-placeholder">${name}</span>${url ? `<img src="${escapeHtml(url)}"${fallback} alt="${name} poster" loading="lazy" decoding="async">` : ''}`;
  const progress = getLatestProgress(item.id);
  const subtitle = [item.year || '', format, item.episodes ? `${item.episodes} episode${item.episodes === 1 ? '' : 's'}` : '', item.score ? `★ ${(item.score / 10).toFixed(1)}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="media-card" data-action="detail" data-id="${escapeHtml(item.id)}" aria-label="Open ${name}">
    <div class="poster">${poster}${progress ? `<span class="chip">${progress.time < 60 ? '&lt;1m' : `${Math.round(progress.time / 60)}m`} watched</span>` : ''}</div>
    <div class="media-caption"><strong>${name}</strong><small>${escapeHtml(subtitle)}</small>${item.genre ? `<span class="genre-label">${escapeHtml(item.genre)}</span>` : ''}</div></button>`;
}

// Anime Center uses a poster-first layout. The other pages retain their
// existing cards and captions, so saved favorites and watch history are intact.
function animePosterCard(item) {
  const name = escapeHtml(item.name);
  const thumbnail = data.lowDataMode ? '' : trustedCover(item.cover);
  const hd = data.lowDataMode ? '' : trustedCover(item.detailCover);
  // Portrait cards should use the portrait cover, not a cropped widescreen detail image.
  const image = thumbnail || hd;
  const fallback = thumbnail && hd && hd !== thumbnail ? ` data-fallback="${escapeHtml(hd)}"` : '';
  const episodeCount = Number.isInteger(item.episodes) && item.episodes > 0 ? item.episodes : 0;
  return `<button type="button" class="anime-poster-card" data-action="detail" data-id="${escapeHtml(item.id)}" aria-label="Open ${name}${episodeCount ? `, ${episodeCount} episodes` : ''}">
    <span class="anime-poster-placeholder" aria-hidden="true">${name}</span>
    ${image ? `<img src="${escapeHtml(image)}"${fallback} alt="" loading="lazy" decoding="async">` : ''}
    <span class="anime-poster-title">${name}</span>
  </button>`;
}

function renderAnimeFeature(items) {
  const container = $('#anime-feature');
  const featured = items.find(item => normalizedTitle(item.name) === 'jujutsukaisen');
  // Use the chosen JJK scene only for the Anime Center's featured banner.
  // The existing series banner and portrait poster remain unchanged.
  const banner = featured && './assets/banners/jujutsu-kaisen-featured.jpg';
  // The featured artwork is a browsing highlight, not a search result or a
  // reason to download images while Low-Data Mode is active.
  if (!featured || !banner || data.lowDataMode || $('#anime-query').value.trim()) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  const name = escapeHtml(featured.name);
  const detailCover = trustedCover(featured.detailCover) || trustedCover(featured.cover);
  const fallback = detailCover ? ` data-fallback="${escapeHtml(detailCover)}"` : '';
  const score = Number.isFinite(featured.score) && featured.score > 0 ? `${(featured.score / 10).toFixed(1)}/10` : '';
  const metadata = [score, featured.year || '', featured.format || 'Anime'].filter(Boolean).join(' · ');
  const description = featured.description || 'Explore the story, browse episodes, and discover your next favorite anime.';
  container.innerHTML = `
    <img class="anime-feature-image" src="${escapeHtml(banner)}"${fallback} alt="" decoding="async" fetchpriority="high">
    <div class="anime-feature-content">
      <span class="anime-feature-eyebrow">✦ FEATURED ANIME</span>
      <h2>${name}</h2>
      <p class="anime-feature-meta">${escapeHtml(metadata)}</p>
      <p class="anime-feature-description">${escapeHtml(description)}</p>
      <div class="anime-feature-actions">
        <button class="anime-feature-watch" type="button" data-action="feature-watch" data-id="${escapeHtml(featured.id)}"><span aria-hidden="true">▶</span> Watch</button>
        <button class="anime-feature-info" type="button" data-action="detail" data-id="${escapeHtml(featured.id)}"><span aria-hidden="true">ⓘ</span> More info</button>
      </div>
    </div>`;
  container.hidden = false;
}

// Prefer the local thumbnail if a HD image cannot load. Keep the text if both fail.
document.addEventListener('error', event => {
  const img = event.target;
  if (img.matches?.('.media-detail-banner')) {
    if (!img.isConnected) return;
    const backdrop = $('#media-detail-hero .media-detail-banner-backdrop');
    let fallbacks = [];
    try { fallbacks = JSON.parse(img.dataset.fallbacks || '[]'); } catch { /* Invalid artwork is never rendered. */ }
    if (fallbacks.length) {
      const [next, ...remaining] = fallbacks;
      img.dataset.fallbacks = JSON.stringify(remaining);
      img.classList.toggle('is-portrait', next.portrait);
      img.alt = `${selected?.name || 'Series'} promotional artwork`;
      img.src = next.url;
      if (backdrop) {
        backdrop.hidden = !next.portrait;
        if (next.portrait) backdrop.src = next.url;
        else backdrop.removeAttribute('src');
      }
    } else {
      img.remove();
      backdrop?.remove();
      $('#media-detail-hero').classList.add('art-unavailable');
      const note = document.createElement('span');
      note.className = 'artwork-note';
      note.textContent = 'Artwork unavailable on this network';
      $('#media-detail-hero .media-detail-hero-copy')?.append(note);
    }
    return;
  }
  if (!img.matches?.('.poster img, .detail-poster img, .anime-poster-card img, .anime-feature-image, .media-episode-thumb img')) return;
  if (img.dataset.fallback) {
    const fallback = img.dataset.fallback;
    img.removeAttribute('data-fallback');
    img.removeAttribute('srcset');
    img.src = fallback;
  } else img.remove();
}, true);

function getLatestProgress(id) {
  return Object.entries(data.progress).filter(([key]) => key.startsWith(`${id}:e`))
    .map(([, record]) => record).filter(r => r && Number.isFinite(r.time) && r.time > 0)
    .sort((a, b) => (b.at || 0) - (a.at || 0))[0];
}

function renderHomeProgress() {
  const recentIds = [...new Set(Object.entries(data.progress).filter(([, v]) => v && v.time > 0)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).map(([key]) => key.replace(/:e\d+$/, '')))].slice(0, 6);
  const items = recentIds.map(id => catalog.get(id) || {id, name: data.progress[Object.keys(data.progress).find(k => k.startsWith(id + ':e'))]?.title || id, type:'anime'});
  $('#home-progress').innerHTML = items.length ? items.map(itemCard).join('') : `<div class="empty-state">Nothing watched yet. Your progress will appear here when you begin an episode.</div>`;
}

const ANIME_PAGE_SIZE = 20;
let animePage = 1;
let animeResults = [];
let displayedAnime = [];
function renderAnime(items, {resetPage = false} = {}) {
  animeResults = items;
  findWideBanners(items);
  const offlineFallback = data.lowDataMode || bannerLookupUnavailable || Boolean(bannerWorker);
  // Keep every local title in the original catalog order, even without a
  // widescreen banner. This gives the complete collection real pages.
  displayedAnime = items.filter(item => item.type === 'anime');
  renderAnimeFeature(items);
  if (resetPage) animePage = 1;
  const totalPages = Math.max(1, Math.ceil(displayedAnime.length / ANIME_PAGE_SIZE));
  animePage = Math.min(animePage, totalPages);
  const start = (animePage - 1) * ANIME_PAGE_SIZE;
  const visible = displayedAnime.slice(start, start + ANIME_PAGE_SIZE);
  const emptyMessage = 'No matching anime found. Try another title or genre.';
  $('#anime-grid').innerHTML = visible.length ? visible.map(animePosterCard).join('') : `<div class="empty-state">${emptyMessage}</div>`;
  $('#anime-count').textContent = `${displayedAnime.length} titles · ${totalPages} page${totalPages === 1 ? '' : 's'}${offlineFallback ? ' · offline ready' : ''}`;
  $('#anime-pagination').hidden = totalPages === 1;
  $('#anime-page-info').textContent = `Page ${animePage} of ${totalPages}`;
  $('#anime-page-numbers').innerHTML = Array.from({length:totalPages}, (_, i) => {
    const page = i + 1;
    return `<button type="button" data-anime-page="${page}" aria-label="Go to anime page ${page}" ${page === animePage ? 'aria-current="page"' : ''}>${page}</button>`;
  }).join('');
  $('#anime-prev').disabled = animePage === 1;
  $('#anime-next').disabled = animePage === totalPages;
}

function changeAnimePage(direction) {
  const next = animePage + direction;
  if (next < 1 || next > Math.max(1,Math.ceil(displayedAnime.length / ANIME_PAGE_SIZE))) return;
  animePage = next;
  renderAnime(animeResults);
  $('#anime-heading').scrollIntoView({behavior:'smooth', block:'start'});
}

function uniqueAnime(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.name.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localAnime(search = '') {
  const words = search.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  const extra = [...data.titles.filter(item => item.type === 'anime'), ...data.animeCache]
    .filter(item => words.every(word => `${item.name} ${item.genre || ''} ${item.description || ''} ${item.year || ''}`.toLocaleLowerCase().includes(word)));
  const custom = extra.filter(item => item.id.startsWith('custom:'));
  const cached = extra.filter(item => !item.id.startsWith('custom:'));
  return uniqueAnime([...searchAnvilCatalog(search), ...custom, ...searchOfflineAnime(search), ...cached]);
}

const animeQuery = `query ($search: String) {
  Page(page: 1, perPage: 24) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
    id title { english romaji } episodes format averageScore coverImage { large } bannerImage
    description(asHtml: false) seasonYear
  } }
}`;

async function loadAnime(search = '') {
  const request = ++searchSerial;
  const saved = localAnime(search);
  $('#anime-heading').textContent = search ? `Results for “${search}”` : 'The anime collection';
  $('#anime-status').classList.remove('error');
  renderAnime(saved, {resetPage:true});
  if (data.lowDataMode) {
    $('#anime-status').textContent = 'Low-Data Mode is on. Your saved anime library remains available without online discovery.';
    return;
  }
  $('#anime-status').textContent = 'Showing the saved poster collection while checking for additional anime…';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let response;
    try {
      response = await fetch('https://graphql.anilist.co', {method:'POST', signal:controller.signal,
        headers:{'Content-Type':'application/json', 'Accept':'application/json'},
        body:JSON.stringify({query:animeQuery, variables:{search:search || null}})});
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw Error(`Catalog returned HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.data?.Page?.media)) throw Error('Catalog response was incomplete');
    if (request !== searchSerial) return;
    const online = payload.data.Page.media.map(row => {
      const name = cleanText(row.title?.english || row.title?.romaji, 120);
      const offline = OFFLINE_ANIME.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      const banner = verifiedBanner(name,row,offline?.year);
      if (banner) rememberWideBanner(name,banner);
      const item = {id:offline?.id || `anime:${row.id}`, name:offline?.name || name, type:'anime',
        episodes:row.episodes ? Math.min(300, Math.max(1, row.episodes)) : 0, format:row.format || 'Anime', score:row.averageScore || 0,
        cover:safeUrl(row.coverImage?.large || '') || '', banner,
        description:cleanText((row.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), 1000), year:row.seasonYear || ''};
      if (offline?.episodeTitles?.length) Object.assign(item, offline);
      if (offline?.cover) {
        item.cover = offline.cover;
        item.detailCover = offline.detailCover;
      }
      // Preserve the original Anvil IDs and JJK episode names.
      if (!ANVIL_CATALOG.some(savedItem => savedItem.id === item.id)) catalog.set(item.id, item);
      return item;
    }).filter(item => item.name);
    const cache = new Map(data.animeCache.map(item => [item.id, item]));
    for (const item of online) if (!ANVIL_CATALOG.some(savedItem => savedItem.id === item.id)) cache.set(item.id, item);
    data.animeCache = [...cache.values()].slice(-200);
    save();
    const items = localAnime(search);
    renderAnime(items);
    $('#anime-status').textContent = 'Saved anime are ready. Use the page numbers to browse the whole collection.';
  } catch (error) {
    if (request !== searchSerial) return;
    bannerLookupUnavailable = true;
    pendingWideBanners.clear();
    $('#retry-banners').hidden = false;
    renderAnime(localAnime(search));
    $('#anime-status').textContent = saved.length
      ? 'Online discovery is unavailable on this network. Showing your saved anime library instead.'
      : 'No saved matches, and online search is unavailable right now. Try another title or genre.';
    if (!saved.length) $('#anime-status').classList.add('error');
  }
}

function openDetails(id) {
  selected = catalog.get(id);
  if (!selected) { status('This title must be loaded again from the catalog.', true); location.hash = '#videos'; return; }
  if (lastRenderedPage !== 'detail') {
    detailReturnPage = lastRenderedPage === 'home' ? 'home' : 'videos';
    detailReturnTab = activeVideoTab;
  }
  const smallCover = data.lowDataMode ? '' : trustedCover(selected.cover);
  const cover = data.lowDataMode ? '' : trustedCover(selected.detailCover) || smallCover;
  const posterFallback = cover !== smallCover && smallCover ? ` data-fallback="${escapeHtml(smallCover)}"` : '';
  const hasEpisodeList = Number.isInteger(selected.episodes) && selected.episodes > 0;
  const officialUrl = safeUrl(selected.officialUrl || '', {allowEmpty:true});
  const sourceUrl = safeUrl(selected.sourceUrl || '', {allowEmpty:true});
  const sourceLinks = [officialUrl ? `<a href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Official series website ↗</a>` : '',
    sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Poster & episode credits: TVmaze ↗</a>` : ''].filter(Boolean).join('');
  $('#detail-head').innerHTML = `<div class="detail-poster">☾${cover ? `<img src="${escapeHtml(cover)}"${posterFallback} alt="${escapeHtml(selected.name)} poster" decoding="async">` : ''}</div>
    <div class="detail-content"><p class="kicker">${escapeHtml(selected.type.toUpperCase())} / CRYALUNE</p>
      <h1>${escapeHtml(selected.name)}</h1><p>${escapeHtml(selected.description || 'A title in your personal collection.')}</p>
      ${selected.genre ? `<span class="chip">${escapeHtml(selected.genre)}</span>` : ''}
      ${selected.year ? `<span class="chip">${escapeHtml(selected.year)}</span>` : ''}
      <span class="chip">${hasEpisodeList ? `${selected.episodes} episode${selected.episodes === 1 ? '' : 's'}` : 'Episode list not yet imported'}</span>
      ${selected.score ? `<span class="chip">★ ${(selected.score / 10).toFixed(1)} / 10</span>` : ''}
      <div class="button-row">${hasEpisodeList ? '<button type="button" class="button primary" data-action="play" data-episode="1">Start watching</button>' : ''}
      <button type="button" class="button" data-action="favorite" data-id="${escapeHtml(selected.id)}">${data.favorites.includes(selected.id) ? '♥ In my favorites' : '♡ Add to my favorites'}</button></div>
      ${sourceLinks ? `<div class="catalog-sources">${sourceLinks}</div>` : ''}</div>`;
  renderEpisodes();
  if (!$('#media-detail-dialog').open) {
    const recent = Object.entries(data.progress).filter(([key, record]) =>
      key.startsWith(`${selected.id}:e`) && Number.isInteger(record?.episode) &&
      record.episode >= 1 && record.episode <= selected.episodes)
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
    selectedEpisode = recent?.[1].episode || 1;
  }
  renderMediaDetail();
  if (!$('#media-detail-dialog').open) $('#media-detail-dialog').showModal();
}

function renderMediaDetail() {
  if (!selected) return;
  const artwork = heroArtwork(selected);
  const [firstArtwork, ...fallbackArtwork] = artwork;
  const metadata = [selected.year || '', selected.format || (selected.type === 'anime' ? 'Anime' : selected.type === 'tv' ? 'TV series' : 'Movie'),
    selected.score ? `★ ${(selected.score / 10).toFixed(1)} / 10` : ''].filter(Boolean);
  $('#media-detail-hero').classList.toggle('art-unavailable', !firstArtwork);
  $('#media-detail-hero').innerHTML = `
    ${firstArtwork ? `<img class="media-detail-banner-backdrop" ${firstArtwork.portrait ? `src="${escapeHtml(firstArtwork.url)}"` : 'hidden'} alt="" aria-hidden="true" decoding="async">` : ''}
    ${firstArtwork ? `<img class="media-detail-banner${firstArtwork.portrait ? ' is-portrait' : ''}" src="${escapeHtml(firstArtwork.url)}" data-fallbacks="${escapeHtml(JSON.stringify(fallbackArtwork))}" alt="${escapeHtml(selected.name)} promotional artwork" loading="eager">` : ''}
    <div class="media-detail-hero-copy"><span class="kicker">CRYALUNE / ${escapeHtml(selected.type.toUpperCase())}</span>
      <h2 id="media-detail-title">${escapeHtml(selected.name)}</h2><p>${escapeHtml(metadata.join(' · '))}</p>
      ${!firstArtwork ? `<span class="artwork-note">${data.lowDataMode ? 'Artwork hidden in Low-Data Mode' : 'Artwork unavailable on this network'}</span>` : ''}</div>`;
  $('#media-detail-description').textContent = selected.description || 'Part of your personal Cryalune collection.';
  $('#media-detail-facts').innerHTML = [
    ['Format', selected.format || (selected.type === 'tv' ? 'TV series' : selected.type === 'anime' ? 'Anime' : 'Movie')],
    ['Release', selected.year || 'Not listed'],
    ['Episodes', Number.isInteger(selected.episodes) && selected.episodes > 0 ? String(selected.episodes) : 'Not listed']
  ].map(([key,value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  $('#media-detail-tags').innerHTML = String(selected.genre || '').split(',').map(genre => genre.trim())
    .filter(Boolean).slice(0,5).map(genre => `<span class="chip">${escapeHtml(genre)}</span>`).join('');
  $('#media-favorite').textContent = data.favorites.includes(selected.id) ? '♥ In My Favorites' : '♡ Add to My Favorites';
  renderMediaEpisodeSelector();
}

function knownSeasons(item) {
  if (Array.isArray(item.seasons) && item.seasons.length) return item.seasons;
  const verified = VERIFIED_SEASONS[normalizedTitle(item.name)];
  if (!Array.isArray(verified) || !verified.length) return [];
  const count = item.episodes;
  const included = verified.filter(group => group.start <= count)
    .map(group => ({...group,end:Math.min(group.end,count)}));
  return included.at(-1)?.end === count ? included : [];
}

function renderMediaEpisodeSelector() {
  if (!selected) return;
  const groups = episodeGroups(selected.episodes, knownSeasons(selected));
  const available = groups.length > 0;
  $('#media-episode-selector').hidden = !available;
  $('#media-episode-mark').hidden = !available;
  $('#media-episode-grid').hidden = true;
  if (!available) {
    $('#media-episode-grid').replaceChildren();
    $('#media-episode-caption').textContent = 'Episode information is not available for this title yet.';
    $('#media-episode-progress').textContent = '';
    $('#media-source-note').textContent = 'Add episode information before selecting a video.';
    return;
  }
  if (selectedEpisode < 1 || selectedEpisode > selected.episodes) selectedEpisode = 1;
  const group = groups.find(item => selectedEpisode >= item.start && selectedEpisode <= item.end) || groups[0];
  $('#media-season').innerHTML = groups.map(item => `<option value="${item.start}">${escapeHtml(item.label)}</option>`).join('');
  $('#media-season').value = String(group.start);
  $('#media-episode').innerHTML = Array.from({length:group.end-group.start+1},(_,index) => {
    const number = group.start + index;
    const title = selected.episodeTitles?.[number-1];
    return `<option value="${number}">${number}. ${escapeHtml(title || `Episode ${number}`)}</option>`;
  }).join('');
  $('#media-episode').value = String(selectedEpisode);
  const title = selected.episodeTitles?.[selectedEpisode-1];
  $('#media-episode-caption').textContent = title ? `Episode ${selectedEpisode} · ${title}` : `Episode ${selectedEpisode} of ${selected.episodes}`;
  const watched = Array.from({length:selected.episodes},(_,index) => episodeMark(progressKey(selected.id,index+1)))
    .filter(mark => mark === 'watched').length;
  $('#media-episode-progress').textContent = `${watched} of ${selected.episodes} watched`;
  const currentMark = episodeMark(currentKey());
  $('#media-episode-mark').textContent = currentMark === 'watched' ? '✓ Watched' : currentMark === 'skipped' ? '↷ Skipped' : '○ Mark watched';
  $('#media-episode-mark').setAttribute('aria-label', `Change episode ${selectedEpisode} status. Currently ${currentMark}`);
  const sourcesForEpisode = availableSources(selected, selectedEpisode);
  const sources = sourcesForEpisode.length;
  const previewOnly = sources > 0 && sourcesForEpisode.every(source => source.preview === true);
  $('#media-source-note').textContent = previewOnly
    ? 'Only a short playback test clip is connected, not the full episode. You can choose an authorized MP4 from your device or add a hosted MP4 source.'
    : sources
    ? `${sources} available playback source${sources === 1 ? '' : 's'} for this episode. You can also choose a local video file.`
      : 'No video source linked to this episode yet. Select Play to add a permitted source or choose a video from your device.';
  const poster = data.lowDataMode ? '' : trustedCover(selected.detailCover) || trustedCover(selected.cover);
  const smallPoster = data.lowDataMode ? '' : trustedCover(selected.cover);
  const posterFallback = poster && smallPoster && poster !== smallPoster ? ` data-fallback="${escapeHtml(smallPoster)}"` : '';
  // The original selector is dropdown-only: no thumbnail or episode card area.
  $('#media-episode-grid').replaceChildren();

}

function episodeMark(key) {
  return data.episodeMarks[key] || (data.progress[key]?.completed ? 'watched' : 'unwatched');
}

function renderEpisodes() {
  if (!selected) return;
  const count = Number.isInteger(selected.episodes) && selected.episodes > 0 ? Math.min(300, selected.episodes) : 0;
  const marks = Array.from({length:count}, (_, i) => episodeMark(progressKey(selected.id, i + 1)));
  const watched = marks.filter(mark => mark === 'watched').length;
  const skipped = marks.filter(mark => mark === 'skipped').length;
  $('#episode-progress-summary').textContent = count ? `${watched}/${count} watched${skipped ? ` · ${skipped} skipped` : ''}` : 'Episode list not yet imported';
  $('#episode-grid').innerHTML = count ? Array.from({length:count}, (_, i) => {
    const episode = i + 1, key = progressKey(selected.id, episode);
    const sources = availableSources(selected, episode).length;
    const time = data.progress[key]?.time || 0;
    const episodeTitle = selected.episodeTitles?.[i];
    const mark = marks[i];
    const markLabel = mark === 'watched' ? '✓ Watched' : mark === 'skipped' ? '↷ Skipped' : '○ Unwatched';
    return `<div class="episode-entry is-${mark}"><button type="button" class="episode-button" data-action="play" data-episode="${episode}"><strong>${String(episode).padStart(2, '0')}</strong>${episodeTitle ? `<span class="episode-name">${escapeHtml(episodeTitle)}</span>` : ''}<small>${sources ? `${sources} source${sources === 1 ? '' : 's'}` : 'No source yet'}${time ? ` · ${Math.round(time / 60)}m played` : ''}</small></button><button type="button" class="episode-check is-${mark}" data-action="episode-mark" data-episode="${episode}" aria-label="Change episode ${episode} status. Currently ${mark}">${markLabel}</button></div>`;
  }).join('') : '<div class="empty-state">This title was in the Anvil gallery, but its episode list was not saved. The catalog card and details are restored; playback entries can be added once episode data is available.</div>';
}

function renderLocalTitles() {
  for (const [type, id] of [['movie', '#movie-grid'], ['tv', '#tv-grid']]) {
    const titles = [...catalog.values()].filter(item => item.type === type);
    $(id).innerHTML = titles.length ? titles.map(itemCard).join('') : `<div class="empty-state">No ${type === 'movie' ? 'movies' : 'TV shows'} yet. Add a title to start organizing your collection.</div>`;
  }
}

function renderFavorites() {
  const items = data.favorites.map(id => catalog.get(id)).filter(Boolean);
  $('#list-grid').innerHTML = items.length ? items.map(itemCard).join('')
    : '<div class="empty-state">No favorites yet. Saved favorites stay visible even when artwork services are unavailable.</div>';
}

function availableSources(item, episode) {
  const key = progressKey(item.id, episode);
  const stored = [...(PUBLISHED_SOURCES[key] || []), ...(data.sources[key] || [])].map(normalizedSource).filter(Boolean);
  if (item.id === demo.id && episode === 1) stored.unshift({id:'built-in-demo',name:'Original demo clip',type:'mp4',url:'./assets/cyralune-demo.mp4',captions:'./assets/cyralune-demo.vtt',priority:0});
  if (item.id === 'anime:113415' && episode === 1) stored.unshift({
    id:'jjk-1080p-preview', name:'1080p playback test · 45 seconds (not full episode)',
    type:'mp4', url:'./assets/jjk-episode-1-1080p-test.mp4', captions:'', priority:0, preview:true
  });
  return sortedSources(stored);
}

function isPreviewClip(source = currentSource) { return source?.preview === true; }

function openSourceEditor() {
  if (!selected) return;
  $('#source-context').textContent = `${selected.name} · Episode ${selectedEpisode}`;
  const key = progressKey(selected.id, selectedEpisode);
  const list = data.sources[key] || [];
  $('#source-list').innerHTML = list.length ? list.map(source =>
    `<div class="source-entry"><div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.type.toUpperCase())} · Priority ${source.priority}</span></div>
      <button data-action="remove-source" data-id="${escapeHtml(source.id)}">Remove</button></div>`).join('') : '<p class="muted">No custom sources saved for this episode.</p>';
  $('#source-dialog').showModal();
}

function currentKey() { return selected ? progressKey(selected.id, selectedEpisode) : ''; }

function stopPlayers() {
  currentSource = null;
  if (hls) { hls.destroy(); hls = null; }
  video.onloadedmetadata = null;
  video.pause(); video.removeAttribute('src'); video.load(); video.replaceChildren();
  embed.src = 'about:blank'; embed.hidden = true; video.hidden = true;
  $('#player-empty').hidden = false;
  updateSubtitlePicker(false);
  updateQualityPicker();
  updateAudioPicker();
  updateNativePlayerControls(false);
}

function clearLocalAttachments() {
  if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
  if (localCaptionUrl) URL.revokeObjectURL(localCaptionUrl);
  localVideoUrl = ''; localCaptionUrl = '';
  $('#local-video').value = ''; $('#local-captions').value = '';
}

function saveCurrentPosition() {
  if (currentSource && !isPreviewClip() && currentSource.type !== 'embed' && Number.isFinite(video.currentTime) && video.currentTime > 0) {
    rememberProgress(video.currentTime, video.duration, video.ended);
  }
}

function closePlayer() {
  pendingAutoplay = false;
  saveCurrentPosition();
  stopPlayers();
  clearLocalAttachments();
  activeSources = []; activeIndex = -1;
  if ($('#player-dialog').open) $('#player-dialog').close();
}

function openPlayer(episode, {autoplay = false} = {}) {
  if (!selected || !Number.isInteger(episode) || episode < 1 || episode > selected.episodes) return;
  if ($('#player-dialog').open) {
    saveCurrentPosition();
    stopPlayers();
    clearLocalAttachments(); // A device file belongs only to the episode where it was chosen.
  }
  selectedEpisode = episode;
  pendingAutoplay = autoplay;
  lastSavedSecond = -1;
  const episodeTitle = selected.episodeTitles?.[episode - 1];
  $('#player-title').textContent = `${selected.name} · Episode ${episode}${episodeTitle ? `: ${episodeTitle}` : ''}`;
  updateEpisodeNavigation();
  activeSources = availableSources(selected, selectedEpisode);
  buildPlayerSourcePicker();
  if (!$('#player-dialog').open) $('#player-dialog').showModal();
  if (activeSources.length) loadSource(0);
  else {
    stopPlayers(); pendingAutoplay = false;
    $('#player-empty').textContent = 'No video connected to this episode. Use a local file or Manage sources to add an authorized video.';
    $('#player-status').textContent = 'No playable source for this episode yet. Choose your video file or add an authorized source.';
  }
}

function updateEpisodeNavigation() {
  const count = selected?.episodes || 0;
  $('#player-prev-episode').disabled = neighboringEpisode(selectedEpisode, -1, count) === null;
  $('#player-next-episode').disabled = neighboringEpisode(selectedEpisode, 1, count) === null;
  $('#player-episode-count').textContent = count ? `Episode ${selectedEpisode} of ${count}` : 'No episodes';
}

function updateSourceNavigation() {
  $('#try-next-source').disabled = nextPlayableSource(activeIndex, activeSources.length) === null;
}

function buildPlayerSourcePicker() {
  $('#player-source').innerHTML = activeSources.length ? activeSources.map((source, index) =>
    `<option value="${index}">${escapeHtml(source.name)} (${escapeHtml(source.type.toUpperCase())})</option>`).join('') : '<option>No sources available</option>';
  $('#player-source').disabled = !activeSources.length;
  updateSourceNavigation();
}

function attachCaptions(url) {
  video.replaceChildren();
  updateSubtitlePicker(Boolean(url));
  if (!url) return;
  const track = document.createElement('track');
  track.kind = 'subtitles'; track.label = 'English'; track.srclang = 'en'; track.src = url; track.default = true;
  video.append(track);
  track.track.mode = 'showing';
}

function updateSubtitlePicker(available) {
  const picker = $('#player-subtitles');
  picker.innerHTML = available ? '<option value="on">English</option><option value="off">Off</option>' : '<option value="off">Off</option>';
  picker.value = available ? 'on' : 'off';
  picker.disabled = !available;
}

function updateNativePlayerControls(enabled) {
  $('#player-speed').disabled = !enabled;
  $('#player-skip-back').disabled = !enabled;
  $('#player-skip-forward').disabled = !enabled;
}

function updateQualityPicker(levels = []) {
  const picker = $('#player-quality');
  picker.replaceChildren(new Option('Auto', 'auto'));
  const seen = new Set();
  levels.forEach((level, index) => {
    const label = level.height ? `${level.height}p` : level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : `Quality ${index + 1}`;
    if (seen.has(label)) return;
    seen.add(label);
    picker.add(new Option(label, String(index)));
  });
  picker.value = 'auto';
  picker.disabled = !levels.length;
}

function updateAudioPicker(tracks = []) {
  const picker = $('#player-audio');
  picker.replaceChildren(new Option('Source default', 'default'));
  tracks.forEach((track, index) => {
    const label = track.name || track.lang || `Audio ${index + 1}`;
    picker.add(new Option(label, String(index)));
  });
  picker.value = 'default';
  picker.disabled = tracks.length < 2;
}

function getHlsLibrary() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsLibraryPromise) hlsLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // Bundle Apache-2.0-licensed hls.js on the same Firebase origin.
    // Some school networks block third-party CDNs even when Cryalune works.
    script.src = './assets/vendor/hls.min.js';
    script.onload = () => window.Hls ? resolve(window.Hls) : reject(Error('HLS library was unavailable'));
    script.onerror = () => reject(Error('HLS library could not be downloaded'));
    document.head.append(script);
  }).catch(error => { hlsLibraryPromise = null; throw error; });
  return hlsLibraryPromise;
}

function loadSource(index) {
  if (!Number.isInteger(index) || index < 0 || index >= activeSources.length) return;
  saveCurrentPosition();
  stopPlayers(); activeIndex = index; currentSource = activeSources[index];
  updateSourceNavigation();
  $('#player-empty').hidden = true; $('#player-source').value = String(index);
  const source = currentSource;
  $('#player-status').classList.remove('error');
  $('#player-status').textContent = `Loading ${source.name}…`;
  if (source.type === 'embed') {
    video.hidden = true; embed.hidden = false; embed.src = source.url;
    pendingAutoplay = false;
    $('#player-status').textContent = 'This provider controls its own playback, quality, audio and subtitles. If it fails, use Try next source.';
    return;
  }
  video.hidden = false; embed.hidden = true;
  updateNativePlayerControls(true);
  video.playbackRate = data.playbackSpeed;
  video.volume = data.playerVolume;
  $('#player-speed').value = String(data.playbackSpeed);
  attachCaptions(localCaptionUrl || source.captions);
  const saved = data.progress[currentKey()];
  const previous = saved && !saved.completed ? Number(saved.time) || 0 : 0;
  video.onloadedmetadata = () => {
    if (currentSource !== source) return;
    if (isPreviewClip(source)) {
      $('#player-status').textContent = '1080p test clip · 45 seconds only. This is not the full episode and will not mark it watched.';
      if (pendingAutoplay) { pendingAutoplay = false; video.play().catch(() => {}); }
      return;
    }
    const resume = previous > 0 && (Number.isFinite(video.duration) ? previous < video.duration - 12 : true);
    if (resume) video.currentTime = previous;
    const minute = Math.floor(previous / 60), second = Math.floor(previous % 60);
    $('#player-status').textContent = resume
      ? `Resuming at ${minute}:${String(second).padStart(2,'0')}. Press Play to continue.`
      : 'Ready to play. Your place is saved automatically.';
    if (pendingAutoplay) {
      pendingAutoplay = false;
      video.play().catch(() => {
        $('#player-status').textContent = 'Next episode is ready. Press Play to start.';
      });
    }
  };
  if (source.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
    getHlsLibrary().then(Hls => {
      if (currentSource !== source) return;
      if (!Hls.isSupported()) { sourceFailed('HLS support is unavailable here'); return; }
      hls = new Hls({maxBufferLength:30});
      hls.on(Hls.Events.ERROR, (_, error) => { if (error.fatal) sourceFailed('HLS playback failed'); });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (currentSource === source) updateQualityPicker(hls.levels);
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        if (currentSource === source) updateAudioPicker(hls.audioTracks);
      });
      hls.loadSource(source.url); hls.attachMedia(video);
    }).catch(() => { if (currentSource === source) sourceFailed('HLS support could not load'); });
  } else { video.src = source.url; video.load(); }
}

function sourceFailed(message) {
  if (!currentSource) return;
  const next = nextPlayableSource(activeIndex, activeSources.length);
  if (next !== null) {
    loadSource(next);
    $('#player-status').textContent = `${message}; trying ${activeSources[next].name}…`;
  } else {
    $('#player-status').textContent = `${message}. No more sources available.`;
    $('#player-status').classList.add('error');
  }
}

video.addEventListener('error', () => { if (currentSource?.type !== 'embed' && video.currentSrc) sourceFailed('Video could not load'); });
video.addEventListener('timeupdate', () => {
  if (!selected || isPreviewClip() || !Number.isFinite(video.currentTime)) return;
  const second = Math.floor(video.currentTime);
  if (second === lastSavedSecond || second % 5 !== 0) return;
  lastSavedSecond = second; rememberProgress(second, video.duration, false);
});
video.addEventListener('pause', () => { if (currentSource && !isPreviewClip()) rememberProgress(video.currentTime, video.duration, false); });
video.addEventListener('ended', () => {
  if (!currentSource) return;
  if (isPreviewClip()) { $('#player-status').textContent = 'Test complete. The full episode was not marked watched.'; return; }
  rememberProgress(video.currentTime, video.duration, true);
  if (!data.autoNext) { $('#player-status').textContent = 'Episode complete. Choose Next episode when you are ready.'; return; }
  const next = neighboringEpisode(selectedEpisode, 1, selected?.episodes || 0);
  if (next === null) { $('#player-status').textContent = 'You reached the last listed episode.'; return; }
  if (!availableSources(selected, next).length) {
    $('#player-status').textContent = 'Episode complete. The next episode has no connected video source yet.';
    return;
  }
  openPlayer(next, {autoplay:true});
});
video.addEventListener('volumechange', () => {
  data.playerVolume = video.volume;
  save();
});
video.addEventListener('ratechange', () => {
  if (!PLAYBACK_SPEEDS.includes(video.playbackRate)) return;
  data.playbackSpeed = video.playbackRate;
  $('#player-speed').value = String(video.playbackRate);
  save();
});

function rememberProgress(time, duration, completed) {
  if (!selected || !Number.isFinite(time) || time < 0) return;
  const key = currentKey();
  data.progress[key] = {title:selected.name, episode:selectedEpisode, time:Math.floor(time),
    duration:Number.isFinite(duration) ? Math.floor(duration) : 0, completed, at:Date.now()};
  if (completed) data.episodeMarks[key] = 'watched';
  save();
  if (completed) renderEpisodes();
}

// Embedded players can report progress only if they document a postMessage contract.
// An origin check prevents arbitrary sites from changing the viewing history.
window.addEventListener('message', event => {
  if (!selected || currentSource?.type !== 'embed') return;
  let expected;
  try { expected = new URL(currentSource.url).origin; } catch { return; }
  if (event.origin !== expected) return;
  let payload = event.data;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { return; } }
  if (!payload || !['timeupdate', 'pause', 'ended'].includes(payload.event)) return;
  const time = Number(payload.currentTime), duration = Number(payload.duration);
  if (Number.isFinite(time) && time >= 0 && time < 500000) rememberProgress(time, duration, payload.event === 'ended');
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'detail') openDetails(button.dataset.id);
  if (action === 'feature-watch') {
    openDetails(button.dataset.id);
    if (selected?.episodes > 0) openPlayer(1);
  }
  if (action === 'play') openPlayer(Number(button.dataset.episode) || 1);
  if (action === 'episode-mark' && selected) {
    const episode = Number(button.dataset.episode);
    if (!Number.isInteger(episode) || episode < 1 || episode > selected.episodes) return;
    const key = progressKey(selected.id, episode);
    const previous = episodeMark(key);
    data.episodeMarks[key] = previous === 'watched' ? 'skipped' : previous === 'skipped' ? 'unwatched' : 'watched';
    save(); renderEpisodes();
  }
  if (action === 'favorite' && selected) {
    data.favorites = data.favorites.includes(selected.id) ? data.favorites.filter(id => id !== selected.id) : [...data.favorites, selected.id];
    save(); renderFavorites(); openDetails(selected.id);
  }
  if (action === 'remove-source') {
    data.sources[currentKey()] = (data.sources[currentKey()] || []).filter(source => source.id !== button.dataset.id);
    save(); $('#source-dialog').close(); openSourceEditor();
    if ($('#player-dialog').open) { activeSources = availableSources(selected, selectedEpisode); buildPlayerSourcePicker(); }
  }
});

$('#go-search').addEventListener('click', () => {
  location.hash = '#videos'; pageRoute(); selectVideoTab('anime'); $('#anime-query').focus();
});
$('#detail-back').addEventListener('click', () => {
  if (detailReturnPage === 'home') location.hash = '#home';
  else { activeVideoTab = detailReturnTab; location.hash = '#videos'; pageRoute(); }
});
$('#media-detail-close').addEventListener('click', () => $('#media-detail-dialog').close());
$('#media-season').addEventListener('change', event => {
  if (!selected) return;
  const group = episodeGroups(selected.episodes, knownSeasons(selected))
    .find(item => item.start === Number(event.target.value));
  if (!group) return;
  selectedEpisode = group.start;
  renderMediaEpisodeSelector();
});
$('#media-episode').addEventListener('change', event => {
  const episode = Number(event.target.value);
  if (!selected || !Number.isInteger(episode) || episode < 1 || episode > selected.episodes) return;
  selectedEpisode = episode;
  renderMediaEpisodeSelector();
});
$('#media-episode-grid').addEventListener('click', event => {
  if (!selected) return;
  const play = event.target.closest('[data-media-play]');
  const mark = event.target.closest('[data-media-mark]');
  const pick = event.target.closest('[data-media-select]');
  const episode = Number((play || mark || pick)?.dataset.mediaPlay || (mark || pick)?.dataset.mediaMark || pick?.dataset.mediaSelect);
  if (!Number.isInteger(episode) || episode < 1 || episode > selected.episodes) return;
  selectedEpisode = episode;
  if (play) { openPlayer(episode); return; }
  if (mark) {
    const key = progressKey(selected.id, episode), previous = episodeMark(key);
    data.episodeMarks[key] = previous === 'watched' ? 'skipped' : previous === 'skipped' ? 'unwatched' : 'watched';
    save(); renderEpisodes();
  }
  renderMediaEpisodeSelector();
});
$('#media-play').addEventListener('click', () => {
  if (selected) openPlayer(selectedEpisode);
});
$('#media-episode-mark').addEventListener('click', () => {
  if (!selected || selectedEpisode < 1 || selectedEpisode > selected.episodes) return;
  const key = currentKey(), previous = episodeMark(key);
  data.episodeMarks[key] = previous === 'watched' ? 'skipped' : previous === 'skipped' ? 'unwatched' : 'watched';
  save(); renderEpisodes(); renderMediaEpisodeSelector();
});
$$('[data-video-tab]').forEach(button => button.addEventListener('click', () => selectVideoTab(button.dataset.videoTab)));
$('.video-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = $$('[data-video-tab]');
  const index = tabs.findIndex(button => button.dataset.videoTab === activeVideoTab);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); selectVideoTab(tabs[next].dataset.videoTab); tabs[next].focus();
});
$('#home-search-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = $('#home-query').value.trim();
  location.hash = '#videos'; pageRoute(); selectVideoTab('anime');
  $('#anime-query').value = query;
  loadAnime(query);
});
let animeSearchTimer;
$('#anime-query').addEventListener('input', () => {
  clearTimeout(animeSearchTimer);
  ++searchSerial; // Invalidate older online requests immediately when the query changes.
  const query = $('#anime-query').value.trim();
  $('#anime-heading').textContent = query ? `Results for “${query}”` : 'The anime collection';
  renderAnime(localAnime(query), {resetPage:true});
  $('#anime-status').textContent = query ? 'Filtering your saved collection…' : 'Showing your saved collection…';
  animeSearchTimer = setTimeout(() => loadAnime(query), 600);
});
$('#anime-search-form').addEventListener('submit', event => {
  event.preventDefault(); clearTimeout(animeSearchTimer);
  loadAnime($('#anime-query').value.trim());
});
$('#anime-prev').addEventListener('click', () => changeAnimePage(-1));
$('#retry-banners').addEventListener('click', () => {
  bannerLookupUnavailable = false;
  $('#retry-banners').hidden = true;
  renderAnime(animeResults);
});
$('#anime-next').addEventListener('click', () => changeAnimePage(1));
$('#anime-page-numbers').addEventListener('click', event => {
  const button = event.target.closest('[data-anime-page]');
  if (!button) return;
  animePage = Number(button.dataset.animePage);
  renderAnime(animeResults);
  $('#anime-heading').scrollIntoView({behavior:'smooth',block:'start'});
});
$('#player-close').addEventListener('click', closePlayer);
$('#cinema-mode').addEventListener('click', () => { data.cinemaMode = !data.cinemaMode; save(); applyPreferences(); });
$('#player-dialog').addEventListener('close', closePlayer);
$('#player-dialog').addEventListener('close', () => {
  if ($('#media-detail-dialog').open) renderMediaEpisodeSelector();
});
$('#player-prev-episode').addEventListener('click', () => {
  const episode = neighboringEpisode(selectedEpisode, -1, selected?.episodes || 0);
  if (episode !== null) openPlayer(episode);
});
$('#player-next-episode').addEventListener('click', () => {
  const episode = neighboringEpisode(selectedEpisode, 1, selected?.episodes || 0);
  if (episode !== null) openPlayer(episode);
});
$('#try-next-source').addEventListener('click', () => {
  const next = nextPlayableSource(activeIndex, activeSources.length);
  if (next !== null) loadSource(next);
});
$('#player-subtitles').addEventListener('change', event => {
  for (const track of video.textTracks) track.mode = event.target.value === 'on' ? 'showing' : 'disabled';
});
$('#player-speed').addEventListener('change', event => {
  const speed = Number(event.target.value);
  if (!video.hidden && PLAYBACK_SPEEDS.includes(speed)) video.playbackRate = speed;
});
$('#player-auto-next').addEventListener('change', event => {
  data.autoNext = event.target.checked;
  save();
});
$('#player-quality').addEventListener('change', event => {
  if (hls) hls.currentLevel = event.target.value === 'auto' ? -1 : Number(event.target.value);
});
$('#player-audio').addEventListener('change', event => {
  if (hls && event.target.value !== 'default') hls.audioTrack = Number(event.target.value);
});
function skipPlayback(seconds) {
  if (video.hidden || !Number.isFinite(video.duration)) return;
  video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration);
}
$('#player-skip-back').addEventListener('click', () => skipPlayback(-10));
$('#player-skip-forward').addEventListener('click', () => skipPlayback(10));
document.addEventListener('keydown', event => {
  if (!$('#player-dialog').open || event.altKey || event.ctrlKey || event.metaKey) return;
  const tag = event.target?.tagName;
  if (['INPUT','SELECT','TEXTAREA','BUTTON'].includes(tag) || event.target?.isContentEditable) return;
  const key = event.key.toLowerCase();
  if (key === 'f') { event.preventDefault(); $('#player-fullscreen').click(); return; }
  if (video.hidden) return; // Embedded video providers manage their own shortcuts.
  if (key === ' ' || key === 'k') {
    event.preventDefault();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  } else if (key === 'arrowleft' || key === 'j') { event.preventDefault(); skipPlayback(-10); }
  else if (key === 'arrowright' || key === 'l') { event.preventDefault(); skipPlayback(10); }
  else if (key === 'm') { event.preventDefault(); video.muted = !video.muted; }
});
$('#player-fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('#player-screen').requestFullscreen();
  } catch { $('#player-status').textContent = 'Fullscreen is unavailable in this browser or source.'; }
});
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement === $('#player-screen');
  $('#player-fullscreen').textContent = fullscreen ? 'Exit Fullscreen' : 'Fullscreen';
  $('#player-fullscreen').setAttribute('aria-pressed', String(fullscreen));
});
$('#player-source').addEventListener('change', event => loadSource(Number(event.target.value)));
$('#manage-source').addEventListener('click', openSourceEditor);

$('#local-video').addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { $('#player-status').textContent = 'Choose an MP4, WebM, or another supported video file.'; return; }
  if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
  localVideoUrl = URL.createObjectURL(file);
  activeSources = [{id:'local-file',name:file.name,type:'mp4',url:localVideoUrl,captions:'',priority:-1},...availableSources(selected,selectedEpisode)];
  buildPlayerSourcePicker(); loadSource(0);
  $('#player-status').textContent = 'Local file ready. It stays on your device and must be chosen again after reopening the page.';
});
$('#local-captions').addEventListener('change', event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (!/\.vtt$/i.test(file.name)) { $('#player-status').textContent = 'Subtitles must be a .vtt file.'; return; }
  if (localCaptionUrl) URL.revokeObjectURL(localCaptionUrl);
  localCaptionUrl = URL.createObjectURL(file);
  if (!video.hidden) attachCaptions(localCaptionUrl);
});

$('#source-form').addEventListener('submit', event => {
  event.preventDefault(); if (!selected) return;
  const item = normalizedSource({id:crypto.randomUUID(),name:$('#source-name').value,type:$('#source-kind').value,
    priority:Number($('#source-priority').value),url:$('#source-url').value,captions:$('#source-captions').value});
  if (!item) { alert('Use a valid HTTPS URL and a priority from 0 to 999.'); return; }
  const key = currentKey();
  if ((data.sources[key] || []).length >= 8) { alert('Maximum eight custom sources for one episode.'); return; }
  data.sources[key] = [...(data.sources[key] || []),item]; save(); event.target.reset();
  $('#source-dialog').close(); openSourceEditor();
  if ($('#player-dialog').open) { activeSources = availableSources(selected,selectedEpisode); buildPlayerSourcePicker(); }
});

$$('.add-title').forEach(button => button.addEventListener('click', () => { $('#title-type').value = button.dataset.type; $('#title-dialog').showModal(); }));
$('#title-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = cleanText($('#title-name').value,100), type = $('#title-type').value;
  const episodes = Math.floor(Number($('#title-episodes').value));
  if (!name || !Number.isInteger(episodes) || episodes < 1 || episodes > 300) return;
  const item = {id:`custom:${crypto.randomUUID()}`,name,type,episodes,description:cleanText($('#title-description').value,700)};
  data.titles.push(item); catalog.set(item.id,item); save(); $('#title-dialog').close(); event.target.reset();
  const newTab = type === 'tv' ? 'shows' : type === 'anime' ? 'anime' : 'movies';
  location.hash = '#videos'; pageRoute(); selectVideoTab(newTab);
  if (type === 'anime') { $('#anime-query').value = ''; loadAnime(); }
  else renderLocalTitles();
});

$('#accent-input').addEventListener('input', event => { data.accent = event.target.value; applyAccent(); save(); });
$('#low-data-mode').addEventListener('change', event => {
  data.lowDataMode = event.target.checked; save(); applyPreferences();
  renderHomeProgress(); renderLocalTitles(); renderFavorites();
  if (selected && lastRenderedPage === 'detail') openDetails(selected.id);
  loadAnime($('#anime-query').value.trim());
});
$('#clear-progress').addEventListener('click', () => {
  if (confirm('Clear all saved watch positions? Your sources, favorites, and manual episode marks will remain.')) { data.progress = {}; save(); renderHomeProgress(); renderEpisodes(); }
});
$('#temporary-test-sound').addEventListener('click', async () => {
  const clip = $('#temporary-test-video');
  const status = $('#temporary-test-sound-status');
  clip.muted = false;
  clip.volume = 1;
  try {
    await clip.play();
    status.textContent = 'Sound is enabled at full player volume. If you still hear nothing, check your Chromebook volume and make sure this Chrome tab is not muted.';
  } catch {
    status.textContent = 'Sound is enabled. Press Play on the video. If it stays silent, check the Chromebook volume and Chrome tab mute setting.';
  }
});
$('#export-data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'cryalune-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
});
$('#import-data').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 5_000_000) { alert('The backup file is too large.'); return; }
  try {
    const imported = JSON.parse(await file.text());
    if (imported?.version !== 1) throw Error('Not a Cryalune v1 backup');
    if (!confirm('Replace this browser’s Cryalune library and progress with the imported backup?')) return;
    data = restoreData(imported); seedCatalog();
    for (const title of data.titles) catalog.set(title.id,title);
    save(); applyAccent(); applyPreferences(); renderHomeProgress(); renderLocalTitles(); renderFavorites(); loadAnime(); pageRoute();
  } catch (error) { alert(`Import failed: ${error.message}`); }
  finally { event.target.value = ''; }
});

renderHomeProgress(); renderLocalTitles(); renderFavorites();
loadAnime(); pageRoute();
