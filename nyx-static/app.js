import {STORAGE_KEY, safeUrl, cleanText, escapeHtml, normalizedSource, sortedSources, defaultData, restoreData, progressKey} from './core.js';
import {ANVIL_CATALOG, searchAnvilCatalog} from './anvil-catalog.js';

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
}
seedCatalog();
for (const title of data.titles) catalog.set(title.id, title);

let selected = null, selectedEpisode = 1, currentSource = null, activeSources = [], activeIndex = -1;
let localVideoUrl = '', localCaptionUrl = '', hls = null, searchSerial = 0, lastSavedSecond = -1;
const video = $('#video');
const embed = $('#embed');

function status(message, error = false) {
  const el = $('#player-dialog').open ? $('#player-status') : $('#anime-status');
  el.textContent = message; el.classList.toggle('error', error);
}

function applyAccent() { document.documentElement.style.setProperty('--accent', data.accent); $('#accent-input').value = data.accent; }
applyAccent();

function pageRoute() {
  let page = location.hash.replace('#', '') || data.lastPage;
  if (page === 'detail' && !selected) page = 'anime';
  if (!$(`[data-view="${page}"]`)) page = 'home';
  $$('.view').forEach(element => element.hidden = element.dataset.view !== page);
  $$('#nav a').forEach(element => { const active = element.dataset.page === page; element.classList.toggle('active', active); if (active) element.setAttribute('aria-current', 'page'); else element.removeAttribute('aria-current'); });
  if (page !== 'detail') { data.lastPage = page; save(); }
  if (page === 'home') renderHomeProgress();
  if (page === 'movies' || page === 'shows') renderLocalTitles();
  if (page === 'websites') renderWebsites();
  if (page === 'list') renderFavorites();
  window.scrollTo({top: 0, behavior: 'instant'});
}
window.addEventListener('hashchange', pageRoute);

function itemCard(item) {
  const name = escapeHtml(item.name), format = escapeHtml(item.format || (item.type === 'tv' ? 'TV series' : item.type === 'anime' ? 'Anime' : 'Movie'));
  const url = safeUrl(item.cover || '', {allowEmpty: true});
  const poster = `<span class="poster-placeholder">${name}</span>${url ? `<img src="${escapeHtml(url)}" alt="${name} poster" loading="lazy">` : ''}`;
  const progress = getLatestProgress(item.id);
  const subtitle = [item.year || '', format, item.episodes ? `${item.episodes} episode${item.episodes === 1 ? '' : 's'}` : '', item.score ? `★ ${(item.score / 10).toFixed(1)}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="media-card" data-action="detail" data-id="${escapeHtml(item.id)}" aria-label="Open ${name}">
    <div class="poster">${poster}${progress ? `<span class="chip">${progress.time < 60 ? '&lt;1m' : `${Math.round(progress.time / 60)}m`} watched</span>` : ''}</div>
    <div class="media-caption"><strong>${name}</strong><small>${escapeHtml(subtitle)}</small>${item.genre ? `<span class="genre-label">${escapeHtml(item.genre)}</span>` : ''}</div></button>`;
}

// Keep the title visible if its remote poster host is unavailable at school.
document.addEventListener('error', event => {
  if (event.target.matches?.('.poster img, .detail-poster img')) event.target.remove();
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
  $('#home-progress').innerHTML = items.length ? items.map(itemCard).join('') : `<div class="empty-state">Nothing watched yet. Start with the original demo reel or add a source to an episode.</div>`;
}

function renderAnime(items) {
  $('#anime-grid').innerHTML = items.length ? items.map(itemCard).join('') : '<div class="empty-state">No matching anime found.</div>';
  $('#anime-count').textContent = `${items.length} title${items.length === 1 ? '' : 's'}`;
}

const animeQuery = `query ($search: String) {
  Page(page: 1, perPage: 24) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
    id title { english romaji } episodes format averageScore coverImage { large }
    description(asHtml: false) seasonYear
  } }
}`;

async function loadAnime(search = '') {
  const request = ++searchSerial;
  const saved = searchAnvilCatalog(search);
  $('#anime-heading').textContent = search ? `Results for “${search}”` : 'The Anvil collection';
  $('#anime-status').classList.remove('error');
  renderAnime(saved);
  if (!search) {
    $('#anime-status').textContent = 'Seven saved anime titles — available even without an internet catalog connection. Video sources are added separately.';
    return;
  }
  $('#anime-status').textContent = 'Showing saved titles now. Checking for additional anime metadata…';
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
      const item = {id:`anime:${row.id}`, name:cleanText(row.title?.english || row.title?.romaji, 120), type:'anime',
        episodes:Math.min(300, Math.max(1, row.episodes || 1)), format:row.format || 'Anime', score:row.averageScore || 0,
        cover:safeUrl(row.coverImage?.large || '') || '',
        description:cleanText((row.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), 1000), year:row.seasonYear || ''};
      // Keep the original Anvil episode names and existing JJK progress ID.
      if (!ANVIL_CATALOG.some(savedItem => savedItem.id === item.id)) catalog.set(item.id, item);
      return item;
    });
    const savedNames = new Set(saved.map(item => item.name.toLocaleLowerCase()));
    const items = [...saved, ...online.filter(item => !savedNames.has(item.name.toLocaleLowerCase()))];
    renderAnime(items);
    $('#anime-status').textContent = 'Saved Anvil titles plus online metadata. Playable video sources must be added separately.';
  } catch (error) {
    if (request !== searchSerial) return;
    $('#anime-status').textContent = saved.length
      ? 'Online search is unavailable, but the saved Anvil matches above still work.'
      : 'No saved matches, and online search is unavailable right now. Try another title or genre.';
    if (!saved.length) $('#anime-status').classList.add('error');
  }
}

function openDetails(id) {
  selected = catalog.get(id);
  if (!selected) { status('This title must be loaded again from the catalog.', true); location.hash = '#anime'; return; }
  const cover = safeUrl(selected.cover || '', {allowEmpty:true});
  const hasEpisodeList = Number.isInteger(selected.episodes) && selected.episodes > 0;
  $('#detail-head').innerHTML = `<div class="detail-poster">☾${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(selected.name)} poster">` : ''}</div>
    <div class="detail-content"><p class="kicker">${escapeHtml(selected.type.toUpperCase())} / CRYALUNE</p>
      <h1>${escapeHtml(selected.name)}</h1><p>${escapeHtml(selected.description || 'A title in your personal collection.')}</p>
      ${selected.genre ? `<span class="chip">${escapeHtml(selected.genre)}</span>` : ''}
      ${selected.year ? `<span class="chip">${escapeHtml(selected.year)}</span>` : ''}
      <span class="chip">${hasEpisodeList ? `${selected.episodes} episode${selected.episodes === 1 ? '' : 's'}` : 'Episode list not yet imported'}</span>
      ${selected.score ? `<span class="chip">★ ${(selected.score / 10).toFixed(1)} / 10</span>` : ''}
      <div class="button-row">${hasEpisodeList ? '<button type="button" class="button primary" data-action="play" data-episode="1">Start watching</button>' : ''}
      <button type="button" class="button" data-action="favorite" data-id="${escapeHtml(selected.id)}">${data.favorites.includes(selected.id) ? '♥ In my list' : '♡ Add to my list'}</button></div></div>`;
  const count = hasEpisodeList ? Math.min(300, selected.episodes) : 0;
  $('#episode-grid').innerHTML = count ? Array.from({length:count}, (_, i) => {
    const episode = i + 1, key = progressKey(selected.id, episode);
    const sources = availableSources(selected, episode).length;
    const time = data.progress[key]?.time || 0;
    const episodeTitle = selected.episodeTitles?.[i];
    return `<button type="button" class="episode-button" data-action="play" data-episode="${episode}"><strong>${String(episode).padStart(2, '0')}</strong>${episodeTitle ? `<span class="episode-name">${escapeHtml(episodeTitle)}</span>` : ''}<small>${sources ? `${sources} source${sources === 1 ? '' : 's'}` : 'No source yet'}${time ? ` · ${Math.round(time / 60)}m watched` : ''}</small></button>`;
  }).join('') : '<div class="empty-state">This title was in the Anvil gallery, but its episode list was not saved. The catalog card and details are restored; playback entries can be added once episode data is available.</div>';
  location.hash = '#detail'; pageRoute();
}

function renderLocalTitles() {
  for (const [type, id] of [['movie', '#movie-grid'], ['tv', '#tv-grid']]) {
    const titles = [...catalog.values()].filter(item => item.type === type);
    $(id).innerHTML = titles.length ? titles.map(itemCard).join('') : `<div class="empty-state">No ${type === 'movie' ? 'movies' : 'TV shows'} yet. Add a title to start organizing your collection.</div>`;
  }
}

function renderFavorites() {
  const recent = Object.entries(data.progress)
    .filter(([, record]) => record && Number.isFinite(record.time) && record.time > 0)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .map(([key]) => key.replace(/:e\d+$/, ''));
  const ids = [...new Set([...recent, ...data.favorites])];
  const items = ids.map(id => catalog.get(id)).filter(Boolean);
  $('#list-grid').innerHTML = items.length ? items.map(itemCard).join('') : '<div class="empty-state">Save a favorite or watch an episode to see it here.</div>';
}

function renderWebsites() {
  $('#website-grid').innerHTML = data.websites.length ? data.websites.map(site =>
    `<div class="feature-card glass"><span class="feature-glyph">◎</span><h3>${escapeHtml(site.name)}</h3>
      <p>${escapeHtml(new URL(site.url).hostname)}</p><div class="button-row"><a class="button primary" href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer">Open website</a>
      <button class="button" data-action="remove-website" data-id="${escapeHtml(site.id)}">Remove</button></div></div>`).join('') :
    '<div class="empty-state">Your directory is empty. Add your first website above.</div>';
}

function availableSources(item, episode) {
  const key = progressKey(item.id, episode);
  const stored = (data.sources[key] || []).map(normalizedSource).filter(Boolean);
  if (item.id === demo.id && episode === 1) stored.unshift({id:'built-in-demo',name:'Original demo clip',type:'mp4',url:'./assets/cyralune-demo.mp4',captions:'./assets/cyralune-demo.vtt',priority:0});
  return sortedSources(stored);
}

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
  video.pause(); video.removeAttribute('src'); video.load(); video.replaceChildren();
  embed.src = 'about:blank'; embed.hidden = true; video.hidden = true;
  $('#player-empty').hidden = false;
}

function saveCurrentPosition() {
  if (currentSource && currentSource.type !== 'embed' && Number.isFinite(video.currentTime) && video.currentTime > 0) {
    rememberProgress(video.currentTime, video.duration, video.ended);
  }
}

function closePlayer() {
  saveCurrentPosition();
  stopPlayers();
  if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
  if (localCaptionUrl) URL.revokeObjectURL(localCaptionUrl);
  localVideoUrl = ''; localCaptionUrl = '';
  $('#local-video').value = ''; $('#local-captions').value = '';
  if ($('#player-dialog').open) $('#player-dialog').close();
}

function openPlayer(episode) {
  if (!selected) return;
  selectedEpisode = episode;
  lastSavedSecond = -1;
  const episodeTitle = selected.episodeTitles?.[episode - 1];
  $('#player-title').textContent = `${selected.name} · Episode ${episode}${episodeTitle ? `: ${episodeTitle}` : ''}`;
  activeSources = availableSources(selected, selectedEpisode);
  buildPlayerSourcePicker();
  $('#player-dialog').showModal();
  if (activeSources.length) loadSource(0);
  else { stopPlayers(); $('#player-status').textContent = 'No source added. Use a local MP4/WebM file or Manage sources.'; }
}

function buildPlayerSourcePicker() {
  $('#player-source').innerHTML = activeSources.length ? activeSources.map((source, index) =>
    `<option value="${index}">${escapeHtml(source.name)} (${escapeHtml(source.type.toUpperCase())})</option>`).join('') : '<option>No sources available</option>';
  $('#player-source').disabled = !activeSources.length;
}

function attachCaptions(url) {
  video.replaceChildren();
  if (!url) return;
  const track = document.createElement('track');
  track.kind = 'subtitles'; track.label = 'English'; track.srclang = 'en'; track.src = url; track.default = true;
  video.append(track);
}

function loadSource(index) {
  if (!Number.isInteger(index) || index < 0 || index >= activeSources.length) return;
  saveCurrentPosition();
  stopPlayers(); activeIndex = index; currentSource = activeSources[index];
  $('#player-empty').hidden = true; $('#player-source').value = String(index);
  const source = currentSource;
  $('#player-status').classList.remove('error');
  $('#player-status').textContent = `Loading ${source.name}…`;
  if (source.type === 'embed') {
    video.hidden = true; embed.hidden = false; embed.src = source.url;
    $('#player-status').textContent = 'Embedded player controls are provided by the source. If it fails, select a different source.';
    return;
  }
  video.hidden = false; embed.hidden = true;
  attachCaptions(localCaptionUrl || source.captions);
  const previous = data.progress[currentKey()]?.time || 0;
  video.onloadedmetadata = () => {
    if (currentSource !== source) return;
    if (previous > 0 && Number.isFinite(video.duration) && previous < video.duration - 12) video.currentTime = previous;
    $('#player-status').textContent = 'Ready to play. Use the video controls for audio, subtitles, and fullscreen.';
  };
  if (source.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
    if (!window.Hls?.isSupported()) { sourceFailed('HLS support is unavailable here'); return; }
    hls = new window.Hls({maxBufferLength:30});
    hls.on(window.Hls.Events.ERROR, (_, error) => { if (error.fatal) sourceFailed('HLS playback failed'); });
    hls.loadSource(source.url); hls.attachMedia(video);
  } else { video.src = source.url; video.load(); }
}

function sourceFailed(message) {
  if (!currentSource) return;
  if (activeIndex + 1 < activeSources.length) {
    const next = activeIndex + 1;
    loadSource(next);
    $('#player-status').textContent = `${message}; trying ${activeSources[next].name}…`;
  } else {
    $('#player-status').textContent = `${message}. No more sources available.`;
    $('#player-status').classList.add('error');
  }
}

video.addEventListener('error', () => { if (currentSource?.type !== 'embed' && video.currentSrc) sourceFailed('Video could not load'); });
video.addEventListener('timeupdate', () => {
  if (!selected || !Number.isFinite(video.currentTime)) return;
  const second = Math.floor(video.currentTime);
  if (second === lastSavedSecond || second % 5 !== 0) return;
  lastSavedSecond = second; rememberProgress(second, video.duration, false);
});
video.addEventListener('pause', () => { if (currentSource) rememberProgress(video.currentTime, video.duration, false); });
video.addEventListener('ended', () => { if (currentSource) rememberProgress(video.currentTime, video.duration, true); });

function rememberProgress(time, duration, completed) {
  if (!selected || !Number.isFinite(time) || time < 0) return;
  data.progress[currentKey()] = {title:selected.name, episode:selectedEpisode, time:Math.floor(time),
    duration:Number.isFinite(duration) ? Math.floor(duration) : 0, completed, at:Date.now()};
  save();
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
  if (action === 'play') openPlayer(Number(button.dataset.episode) || 1);
  if (action === 'favorite' && selected) {
    data.favorites = data.favorites.includes(selected.id) ? data.favorites.filter(id => id !== selected.id) : [...data.favorites, selected.id];
    save(); openDetails(selected.id);
  }
  if (action === 'remove-website') { data.websites = data.websites.filter(site => site.id !== button.dataset.id); save(); renderWebsites(); }
  if (action === 'remove-source') {
    data.sources[currentKey()] = (data.sources[currentKey()] || []).filter(source => source.id !== button.dataset.id);
    save(); $('#source-dialog').close(); openSourceEditor();
    if ($('#player-dialog').open) { activeSources = availableSources(selected, selectedEpisode); buildPlayerSourcePicker(); }
  }
});

$('#go-search').addEventListener('click', () => { location.hash = '#anime'; $('#anime-query').focus(); });
$('#detail-back').addEventListener('click', () => { location.hash = selected?.type === 'anime' ? '#anime' : selected?.type === 'tv' ? '#shows' : '#movies'; });
$('#anime-search-form').addEventListener('submit', event => { event.preventDefault(); loadAnime($('#anime-query').value.trim()); });
$('#player-close').addEventListener('click', closePlayer);
$('#player-dialog').addEventListener('close', closePlayer);
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
  location.hash = type === 'tv' ? '#shows' : '#movies'; renderLocalTitles();
});

$('#website-form').addEventListener('submit', event => {
  event.preventDefault();
  const url = safeUrl($('#website-url').value), name = cleanText($('#website-name').value,70);
  if (!url || !name) { alert('Enter a name and a complete HTTPS address.'); return; }
  data.websites.push({id:crypto.randomUUID(),name,url}); save(); event.target.reset(); renderWebsites();
});

$('#accent-input').addEventListener('input', event => { data.accent = event.target.value; applyAccent(); save(); });
$('#clear-progress').addEventListener('click', () => {
  if (confirm('Clear all saved watch positions? Your sources and favorites will remain.')) { data.progress = {}; save(); renderHomeProgress(); }
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
    save(); applyAccent(); renderHomeProgress(); renderWebsites(); renderLocalTitles(); renderFavorites(); loadAnime(); pageRoute();
  } catch (error) { alert(`Import failed: ${error.message}`); }
  finally { event.target.value = ''; }
});

renderHomeProgress(); renderLocalTitles(); renderWebsites(); renderFavorites();
loadAnime(); pageRoute();
