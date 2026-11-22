// Fetch the original poster images published through TVmaze's API and keep
// carefully compressed HD WebP copies for Cryalune's own Firebase hosting.
// https://www.tvmaze.com/api#images permits indefinite server-side caching.
// This does not upscale sources: an image cannot gain genuine detail by resizing.
import {mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {ANIME_GALLERY} from '../nyx-static/anime-gallery.js';

const target = new URL('../nyx-static/assets/posters-hd/', import.meta.url);
const slug = name => name.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const timeoutMs = 45000;
let nextIndex = 0;
const results = [], failures = [];

function convertToWebP(imageBuffer) {
  return new Promise((resolve, reject) => {
    const process = spawn('magick', [
      '-', '-auto-orient', '-resize', '768x>', '-strip',
      '-quality', '85', '-define', 'webp:method=5', 'webp:-'
    ], {stdio:['pipe','pipe','pipe']});
    const parts = [];
    let diagnostic = '';
    process.stdout.on('data', chunk => parts.push(chunk));
    process.stderr.on('data', chunk => { diagnostic += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => {
      const bytes = Buffer.concat(parts);
      if (code !== 0 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
          bytes.toString('ascii', 8, 12) !== 'WEBP') reject(Error(`WebP conversion failed: ${diagnostic}`));
      else resolve(bytes);
    });
    process.stdin.on('error', reject);
    process.stdin.end(imageBuffer);
  });
}

async function worker() {
  while (nextIndex < ANIME_GALLERY.length) {
    const item = ANIME_GALLERY[nextIndex++];
    try {
      const source = new URL(item.cover);
      if (source.protocol !== 'https:' || source.hostname !== 'static.tvmaze.com' ||
          !source.pathname.includes('/medium_portrait/')) throw Error('Unverified poster URL');
      source.pathname = source.pathname.replace('/medium_portrait/', '/original_untouched/');
      const response = await fetch(source, {signal:AbortSignal.timeout(timeoutMs)});
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
        throw Error(`Original artwork not available (${response.status})`);
      const original = Buffer.from(await response.arrayBuffer());
      if (original.length > 12_000_000 || original.length < 1000)
        throw Error('Original image size was invalid');
      const optimized = await convertToWebP(original);
      await writeFile(new URL(`${slug(item.name)}.webp`, target), optimized);
      results.push({name:item.name, originalBytes:original.length, optimizedBytes:optimized.length});
    } catch (error) { failures.push(`${item.name}: ${error.message}`); }
  }
}

await mkdir(target, {recursive:true});
await Promise.all(Array.from({length:6}, () => worker()));
const originalBytes = results.reduce((sum, item) => sum + item.originalBytes, 0);
const optimizedBytes = results.reduce((sum, item) => sum + item.optimizedBytes, 0);
console.log(JSON.stringify({completed:results.length, originalMB:(originalBytes/1e6).toFixed(2),
  webpMB:(optimizedBytes/1e6).toFixed(2), failures}, null, 2));
if (failures.length) process.exitCode = 1;
