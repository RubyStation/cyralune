# Cryalune Cloudflare Worker — demo only

This Worker demonstrates Cloudflare-hosted video playback using Cryalune's **original short test clip**. The clip is included as a static asset in `public/demo.mp4` and no longer depends on an upstream request to Firebase. It does not contain, locate, or unlock any Jujutsu Kaisen episode, N7X backend, DRM stream, or third-party media.

## What it does

- `GET /health`: returns a status message
- `GET /demo.mp4`: serves the bundled original MP4 from Cloudflare Static Assets
- `HEAD /demo.mp4`: serves metadata
- `GET /demo.mp4` with `Range: bytes=0-1023`: forwards the range header to Static Assets (which currently responds with the small full file, HTTP 200)
- Ignores benign `utm_*` tracking parameters and rejects arbitrary source URLs, other paths and foreign website origins

The Worker forwards the static asset's response body without buffering it. Access depends on Cloudflare being available on the viewer's network. For full-length video and efficient seeking, use proper range-capable storage such as R2 rather than large Workers Static Assets files.

## Run tests

From the main repository directory:

```bash
npm test
```

## Deploy only when ready

1. Create a **Free** Cloudflare account at https://dash.cloudflare.com/.
2. On a computer with Node.js, open a terminal in `cloudflare-worker/`.
3. Run `npx wrangler login --device --browser=false` and complete sign-in in your browser if needed.
4. Run `npx wrangler deploy`. It should show your personal `*.workers.dev` URL.
5. Visit `https://YOUR-WORKER.workers.dev/health` and then `/demo.mp4`.

**Do not deploy this Worker expecting anime playback**: it is an isolated test and the website has not been changed to use it. After the test works on the Chromebook, we can decide whether to connect Cryalune to a video service for which you have explicit access and redistribution/streaming permission.

The Worker does not bypass school network restrictions, remove DRM, or use N7X's live backend.
