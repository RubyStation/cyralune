// Cache TVmaze's medium-sized official API thumbnails with attribution.
// Their API docs expressly recommend server-side caching of these image URLs:
// https://www.tvmaze.com/api#images
import {mkdir, writeFile} from 'node:fs/promises';
import {ANIME_GALLERY} from '../nyx-static/anime-gallery.js';

const folder = new URL('../nyx-static/assets/posters/', import.meta.url);
const slug = name => name.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
await mkdir(folder, {recursive:true});
let index = 0, completed = 0;
const failed = [];

async function worker() {
  while (index < ANIME_GALLERY.length) {
    const item = ANIME_GALLERY[index++];
    const url = new URL(item.cover);
    if (url.protocol !== 'https:' || url.hostname !== 'static.tvmaze.com') {
      failed.push(`${item.name}: untrusted artwork host`); continue;
    }
    try {
      const response = await fetch(url, {signal:AbortSignal.timeout(25000)});
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg'))
        throw Error(`invalid image response ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 700_000 || bytes.length < 1000 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        throw Error('invalid JPEG');
      await writeFile(new URL(`${slug(item.name)}.jpg`, folder), bytes);
      completed++;
    } catch (error) { failed.push(`${item.name}: ${error.message}`); }
  }
}

await Promise.all(Array.from({length:8}, () => worker()));
console.log(JSON.stringify({completed, failed}, null, 2));
if (failed.length) process.exitCode = 1;
