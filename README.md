# Cryalune — The Lunar Cinema

An independent, buildless, single-website media library. No Anvil account,
server module, database subscription, or paid hosting is required to run the
static frontend.

## Included

- Moonrise home screen with a centered identity and a calm charcoal design.
- Videos section with Anime, Movies, TV Shows, and My Favorites tabs (Anime opens first).
- Cinema Mode in the video player, manual watched/skipped/unwatched episode checklist,
  Low-Data Mode, and an adjustable Small / Medium / Large poster dropdown.
- Seven original Anvil anime entries bundled offline. Additional AniList discoveries
  are remembered on this device. A separate title-only offline discovery index
  provides 99 additional anime names without requiring the AniList connection;
  episode data and video sources are not invented. Missing titles can be added manually.
- Home, Videos, and Settings in one responsive site; no Links category.
- AniList-powered title discovery, ratings, and official/promotional cover art.
- Locally cached, credited TVmaze posters for all seven original Anvil series,
  with high-resolution copies for their detail views. The other 76 poster-backed
  anime also have locally stored thumbnails and HD artwork.
- Full-width series artwork in title selection: a verified AniList widescreen
  banner when it loads, or that series' own poster when unavailable.
  Source-verified TVmaze landscapes at 1,880+ pixels wide are preferred and
  cached locally wherever available, with no dependency on AniList loading.
  The remaining series show sharp portraits in the right side of the hero
  instead of stretched/blurred poster backgrounds. Low-Data Mode still hides
  artwork downloads by design.
- A built-in **Jujutsu Kaisen Season 1** title/episode listing (metadata only).
- An original short demo MP4 and caption file so you can test the player.
- A player for your own local MP4/WebM files or HTTPS MP4/HLS sources; optional
  HLS.js loading; sandboxed third-party embeds when the provider permits it.
- Per-episode source priority and fallback when a native stream fails.
- HLS.js is loaded only when an HLS stream is selected, reducing initial downloads.
- Native video controls for audio volume, subtitles, and fullscreen.
- Watch progress, manual episode marks, appearance preferences, favorites, and sources
  saved in this browser. Historical website bookmarks remain in exported backups for safekeeping.
- JSON backup export/import. No source credentials should be stored here.

**Not included:** Jujutsu Kaisen video files, a licensed anime-streaming API,
the N7X VPN/relay, or a server that can proxy restricted sites. Being able to
play a source depends on the source owner's permissions, your browser, and the
network you use. This app does not defeat a Chromebook's web restrictions.

## Run it

The browser must serve JavaScript modules over HTTP(S), so don't double-click
`index.html` as a `file:` URL. From the repository folder, run:

```bash
python3 -m http.server 8000 --directory nyx-static
```

Then open **http://localhost:8000**. On Windows, `py -m http.server 8000
--directory nyx-static` works when Python is installed.

The main website is in `nyx-static/studies.html`. The `index.html` in that
folder sends visitors there, so both the hosted site root and `/studies.html`
work on an ordinary static web host.

To test playback: Videos → Movies → **The Lunar Test Reel** → **Episode 1**.
The bundled demo is an original test clip, not a JJK episode.

For JJK: Videos → Anime → search Jujutsu Kaisen → select an episode → Manage sources
or choose a video file you already own and are permitted to use.

## Put Cryalune on GitHub

1. Keep all website files in **`nyx-static/`**, replacing the old `dist/` folder.
2. For a static host, set the publish/output directory to `nyx-static`.
   The `index.html` in that folder opens the full site.
3. Hosting is separate from storing code in GitHub. A private repository does
   not by itself provide a publicly accessible website.
4. jsDelivr serves files from public repositories, but its documented HTML
   content type is `text/plain`; use a website host for reliable HTML rendering.

The site itself needs no backend, but anime discovery, streaming, and HLS.js
load external resources and are subject to the respective providers' limits
and rules. The external HLS library is optional; without it native MP4 still
works and HLS works only in browsers with built-in HLS support.

## Development

```bash
npm test
npm run check
```

Code layout:

| Path | Role |
| --- | --- |
| `nyx-static/index.html` | Redirect from the hosted site root to the main page |
| `nyx-static/studies.html` | Interface and player dialogs |
| `nyx-static/styles.css` and `quiet-theme.css` | Original layouts and charcoal Moonrise theme |
| `nyx-static/assets/moonrise-logo.svg` | Moonrise logo with gray horizon lines |
| `nyx-static/app.js` | Catalog, pages, playback, progress, backups |
| `nyx-static/core.js` | Source validation and state helpers |
| `nyx-static/assets/` | Original test MP4 and subtitles |
| `tests/` | Node tests for important validation paths |

The original seven local poster pairs can be refreshed from TVmaze with
`node scripts/cache-anvil-posters.mjs` when building the site. This requires
ImageMagick and internet access on the development computer, not on the viewer's
Chromebook. The site itself never makes those TVmaze image requests.

To audit original poster and landscape source resolutions, run
`node scripts/upgrade-anime-artwork.mjs --audit`. To refresh genuine source
posters at least 1,880 pixels wide and source-backed landscape banners, run
`node scripts/upgrade-anime-artwork.mjs --download`. That script updates the
local banner manifest and never upscales a lower-resolution file to pass the
1,880-pixel threshold. Not every catalog title has a qualifying source image.

## Provenance and permissions

The user's N7X code references informed architectural research, but this
project is independently implemented; it does not bundle or use N7X's private
networking or third-party video APIs. When you have separate permission to use
specific sources, add their approved HTTPS URLs through Cryalune's interface.

Cover images and catalog metadata belong to their respective owners/providers.
This repository contains no generated replacement anime posters.

## Privacy notes

The repository should not contain passwords, API credentials, signed playback
URLs, school login tokens, or personal browsing exports. Sources added in the
interface are stored only in that browser's local storage and exported backups.
Browser local storage is not encrypted; use the backup feature carefully.
