// Cache TVmaze's credited series posters for the seven original Anvil titles.
// Keeping these on the site's own host avoids broken images on school networks
// that deny hotlinked image domains. TVmaze API image caching:
// https://www.tvmaze.com/api#images
import {mkdir, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';

const shows = [
  ['jujutsu-kaisen', 48450, 'Jujutsu Kaisen', 2020],
  ['pokemon', 590, 'Pokémon', 1997],
  ['one-piece', 1505, 'One Piece', 1999],
  ['doraemon', 55578, 'Doraemon', 2005],
  ['chibi-maruko-chan', 22517, 'Chibi Maruko-chan', 1990],
  ['detective-conan', 5429, 'Detective Conan', 1996],
  ['ninja-boy-rantaro', 88345, 'Nintama Rantaro', 1993]
];
const images = new URL('../nyx-static/assets/posters/', import.meta.url);
const hdImages = new URL('../nyx-static/assets/posters-hd/', import.meta.url);

function optimize(original) {
  return new Promise((resolve, reject) => {
    const task = spawn('magick', ['-', '-auto-orient', '-resize', '768x>', '-strip',
      '-quality', '85', '-define', 'webp:method=5', 'webp:-'], {stdio:['pipe','pipe','pipe']});
    const chunks = [], errors = [];
    task.stdout.on('data', chunk => chunks.push(chunk));
    task.stderr.on('data', chunk => errors.push(chunk));
    task.on('error', reject);
    task.on('close', code => {
      const bytes = Buffer.concat(chunks);
      if (code || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')
        reject(Error(`ImageMagick failed: ${Buffer.concat(errors).toString()}`));
      else resolve(bytes);
    });
    task.stdin.on('error', reject);
    task.stdin.end(original);
  });
}

async function imageBuffer(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(45000)});
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg'))
    throw Error(`Poster fetch failed: ${response.status}`);
  const result = Buffer.from(await response.arrayBuffer());
  if (result.length < 1000 || result.length > 12_000_000 || result[0] !== 0xff || result[1] !== 0xd8)
    throw Error('Unexpected JPEG response');
  return result;
}

await Promise.all([mkdir(images, {recursive:true}), mkdir(hdImages, {recursive:true})]);
const failures = [];
await Promise.all(shows.map(async ([slug, id, name, year]) => {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${id}`, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`TVmaze returned ${response.status}`);
    const show = await response.json();
    if (show.name !== name || Number(show.premiered?.slice(0, 4)) !== year) throw Error('TVmaze title/year mismatch');
    const medium = new URL(show.image?.medium);
    if (medium.hostname !== 'static.tvmaze.com' || !medium.pathname.includes('/medium_portrait/'))
      throw Error('Unexpected TVmaze image URL');
    const full = new URL(medium);
    full.pathname = full.pathname.replace('/medium_portrait/', '/original_untouched/');
    const [thumbnail, original] = await Promise.all([imageBuffer(medium), imageBuffer(full)]);
    const webp = await optimize(original);
    await Promise.all([writeFile(new URL(`${slug}.jpg`, images), thumbnail),
      writeFile(new URL(`${slug}.webp`, hdImages), webp)]);
    console.log(`Cached ${name}`);
  } catch (error) { failures.push(`${name}: ${error.message}`); }
}));
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
