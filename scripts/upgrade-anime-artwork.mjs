// Rebuild high-resolution Cryalune artwork from the credited TVmaze show entries.
// We never enlarge an image to meet a resolution target; images with an original
// width below 1880 pixels are not relabeled as high-resolution replacements.
// Usage: node scripts/upgrade-anime-artwork.mjs --audit
//        node scripts/upgrade-anime-artwork.mjs --download
import {mkdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {ANIME_GALLERY} from '../nyx-static/anime-gallery.js';
import {ANVIL_CATALOG} from '../nyx-static/anvil-catalog.js';
import {normalizedTitle} from '../nyx-static/banner-catalog.js';

const download = process.argv.includes('--download');
const audit = process.argv.includes('--audit');
if (download === audit) throw Error('Choose exactly one of --audit or --download');

const allSeries = [...ANIME_GALLERY, ...ANVIL_CATALOG].map(show => ({
  name:show.name, id:Number(show.sourceUrl?.match(/tvmaze\.com\/shows\/(\d+)/)?.[1])
})).filter(show => show.id);
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const chosen = new Set(only?.split(',').map(name => name.trim()) || []);
const series = only ? allSeries.filter(show => chosen.has(show.name)) : allSeries;
const slug = name => name.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const posterFolder = new URL('../nyx-static/assets/posters-hd/', import.meta.url);
const bannerFolder = new URL('../nyx-static/assets/banners/', import.meta.url);
const manifestFile = new URL('../nyx-static/local-banner-catalog.js', import.meta.url);
const results = [], failures = [];
let cursor = 0;

async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve,500*(attempt+1)));
    }
  }
}

function source(image) {
  const info = image.resolutions?.original;
  if (!info || !Number.isInteger(info.width) || !Number.isInteger(info.height)) return null;
  try {
    const url = new URL(info.url);
    if (url.protocol !== 'https:' || url.hostname !== 'static.tvmaze.com' || !url.pathname.startsWith('/uploads/images/original_untouched/')) return null;
    return {url:url.toString(), width:info.width, height:info.height};
  } catch { return null; }
}

function select(images, kinds, width, minRatio, maxRatio) {
  return images.filter(image => kinds.includes(image.type)).map(source).filter(Boolean)
    .filter(image => image.width >= width && image.width / image.height >= minRatio && image.width / image.height <= maxRatio)
    .sort((a,b) => (b.width*b.height)-(a.width*a.height))[0] || null;
}

function webp(bytes, maximumWidth) {
  return new Promise((resolve,reject) => {
    const proc = spawn('magick', ['-', '-auto-orient', '-resize', `${maximumWidth}x>`, '-strip',
      '-quality', '87', '-define', 'webp:method=5', 'webp:-'], {stdio:['pipe','pipe','pipe']});
    const out = [], err = [];
    proc.stdout.on('data', chunk => out.push(chunk));
    proc.stderr.on('data', chunk => err.push(chunk));
    proc.on('error', reject);
    proc.on('close', code => {
      const image = Buffer.concat(out);
      if (code || image.toString('ascii',0,4) !== 'RIFF' || image.toString('ascii',8,12) !== 'WEBP')
        reject(Error(`ImageMagick: ${Buffer.concat(err).toString()}`));
      else resolve(image);
    });
    proc.stdin.on('error', reject);
    proc.stdin.end(bytes);
  });
}

async function saveArtwork(image, folder, name, widthLimit) {
  const response = await request(image.url);
  if (!response.headers.get('content-type')?.startsWith('image/')) throw Error('Expected image');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000 || bytes.length > 14_000_000) throw Error('Original image too large or invalid');
  const result = await webp(bytes, widthLimit);
  await writeFile(new URL(`${slug(name)}.webp`, folder), result);
}

await Promise.all([mkdir(posterFolder,{recursive:true}), mkdir(bannerFolder,{recursive:true})]);
async function worker() {
  while (cursor < series.length) {
    const show = series[cursor++];
    try {
      const images = await (await request(`https://api.tvmaze.com/shows/${show.id}/images`)).json();
      if (!Array.isArray(images)) throw Error('Invalid TVmaze image list');
      const poster = select(images,['poster'],1880,.48,.95);
      const banner = select(images,['background','banner'],1880,1.5,2.4);
      results.push({name:show.name,poster:poster?.width || 0,banner:banner?.width || 0});
      if (download) {
        if (poster) {
          try { await saveArtwork(poster,posterFolder,show.name,1920); }
          catch (err) { failures.push(`${show.name} poster: ${err.message}`); }
        }
        if (banner) {
          try { await saveArtwork(banner,bannerFolder,show.name,2560); }
          catch (err) { failures.push(`${show.name} background: ${err.message}`); }
        }
      }
    } catch (err) { failures.push(`${show.name}: ${err.message}`); }
  }
}
await Promise.all(Array.from({length:6}, () => worker()));
results.sort((a,b)=>a.name.localeCompare(b.name));
if (download) {
  const entries = allSeries.filter(row => existsSync(new URL(`${slug(row.name)}.webp`, bannerFolder)))
    .map(row => `  ${JSON.stringify(normalizedTitle(row.name))}: ${JSON.stringify(`./assets/banners/${slug(row.name)}.webp`)}`);
  await writeFile(manifestFile, `// Landscape source images are TVmaze originals at least 1880px wide.\n` +
    `// Generated by scripts/upgrade-anime-artwork.mjs.\n` +
    `export const LOCAL_BANNERS = Object.freeze({\n${entries.join(',\n')}\n});\n`);
}
const summary = {total:series.length,examined:results.length,posters1880:results.filter(r=>r.poster).length,
  landscape1880:results.filter(r=>r.banner).length,failures,series:results};
console.log(JSON.stringify(summary,null,2));
if (failures.length) process.exitCode = 1;
