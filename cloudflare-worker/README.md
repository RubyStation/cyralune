# Cryalune Cloudflare Worker — demo only

This Worker demonstrates a restricted Cloudflare media fetch using Cryalune's **original short test clip**, with a local fallback. It first fetches `https://cryalune.firebaseapp.com/assets/cyralune-demo.mp4` and, if that request fails, serves the same clip bundled as a static asset in `public/demo.mp4`. It does not contain, locate, or unlock any Jujutsu Kaisen episode, N7X backend, DRM stream, or third-party media.

## What it does

- `GET /health`: returns a status message
- `GET /demo.mp4`: fetches the known Firebase MP4, using the bundled asset if needed
- `HEAD /demo.mp4`: forwards metadata requests to the same two sources
- `GET /demo.mp4` with `Range: bytes=0-1023`: forwards a byte-range request to Firebase (or to Static Assets as a fallback, which currently responds with the small full file, HTTP 200)
- Adds `X-Cryalune-Video-Source: firebase` or `bundled` to show which source handled the request
- Ignores benign `utm_*` tracking parameters and rejects arbitrary source URLs, other paths and foreign website origins

The Worker forwards the selected response body without buffering it. Access depends on Cloudflare and, when using the primary source, Firebase being available on the viewer's network. For full-length video and efficient seeking, use proper range-capable storage such as R2 rather than large Workers Static Assets files.

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
