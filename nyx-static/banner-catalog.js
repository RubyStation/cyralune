import {safeUrl} from './core.js';

export const BANNER_CACHE_KEY = 'cryalune-wide-banners-v1';

export function normalizedTitle(value) {
  return String(value || '').toLocaleLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

// Query in small batches so the catalog does not send one request per card.
export function bannerQuery(names) {
  if (!Array.isArray(names) || !names.length || names.length > 12) return '';
  return `query { ${names.map((name, index) =>
    `b${index}: Media(search: ${JSON.stringify(String(name).slice(0,120))}, type: ANIME) { bannerImage title { english romaji native } synonyms seasonYear startDate { year } }`
  ).join(' ')} }`;
}

export function verifiedBanner(name, media, year = 0) {
  if (!media || typeof media !== 'object') return '';
  const expected = normalizedTitle(name);
  const names = [media.title?.english, media.title?.romaji, media.title?.native, ...(Array.isArray(media.synonyms) ? media.synonyms : [])];
  if (!expected || !names.some(candidate => normalizedTitle(candidate) === expected)) return '';
  const foundYear = media.startDate?.year || media.seasonYear;
  if (Number.isInteger(year) && year > 0 && Number.isInteger(foundYear) && foundYear > 0 && year !== foundYear) return '';
  const url = safeUrl(media.bannerImage || '');
  if (!url) return '';
  const host = new URL(url).hostname.toLowerCase();
  return host === 'anilist.co' || host.endsWith('.anilist.co') ? url : '';
}
