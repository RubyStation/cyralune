export const STORAGE_KEY = 'cyralune-web-v1';

export function safeUrl(raw, {allowEmpty = false} = {}) {
  if (raw === '' && allowEmpty) return '';
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function cleanText(value, maximum = 100) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function normalizedSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = cleanText(raw.type, 10).toLowerCase();
  const url = safeUrl(raw.url);
  const captions = safeUrl(raw.captions || '', {allowEmpty: true});
  const priority = Number(raw.priority ?? 10);
  if (!['mp4', 'hls', 'embed'].includes(type) || !url || captions === null ||
      !Number.isInteger(priority) || priority < 0 || priority > 999) return null;
  return {id: cleanText(raw.id, 100) || crypto.randomUUID(), name: cleanText(raw.name, 70) || 'Source',
    type, url, captions, priority};
}

export function sortedSources(sources) {
  return sources.filter(Boolean).slice().sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export function defaultData() {
  return {version: 1, lastPage: 'home', accent: '#a999ff', favorites: [], progress: {}, sources: {}, websites: [], titles: []};
}

export function restoreData(raw) {
  const initial = defaultData();
  if (!raw || typeof raw !== 'object') return initial;
  const pages = ['home', 'anime', 'movies', 'shows', 'websites', 'list', 'settings'];
  const color = /^#[0-9a-f]{6}$/i.test(raw.accent || '') ? raw.accent : initial.accent;
  return {
    ...initial,
    lastPage: pages.includes(raw.lastPage) ? raw.lastPage : initial.lastPage,
    accent: color,
    favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(v => typeof v === 'string').slice(0, 3000) : [],
    progress: raw.progress && typeof raw.progress === 'object' && !Array.isArray(raw.progress) ? raw.progress : {},
    sources: Object.fromEntries(Object.entries(raw.sources && typeof raw.sources === 'object' && !Array.isArray(raw.sources) ? raw.sources : {})
      .slice(0, 2000).map(([key, list]) => [key, Array.isArray(list) ? list.map(normalizedSource).filter(Boolean).slice(0, 15) : []])),
    websites: Array.isArray(raw.websites) ? raw.websites.slice(0, 3000).map(v => ({
      id: cleanText(v?.id, 100) || crypto.randomUUID(),
      name: cleanText(v?.name, 70), url: safeUrl(v?.url)
    })).filter(v => v.name && v.url) : [],
    titles: Array.isArray(raw.titles) ? raw.titles.slice(0, 500).map(v => ({
      id: cleanText(v?.id, 100), name: cleanText(v?.name, 100), type: v?.type === 'tv' ? 'tv' : 'movie',
      description: cleanText(v?.description, 700), episodes: Math.max(1, Math.min(300, Number(v?.episodes) || 1))
    })).filter(v => v.id && v.name) : []
  };
}

export function progressKey(titleId, episode) { return `${titleId}:e${episode}`; }
