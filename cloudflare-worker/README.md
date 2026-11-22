# Cryalune Cloudflare Worker — demo only

This Worker demonstrates a restricted, streaming media relay using the **original Cryalune test clip** already hosted on Firebase. It does not contain, locate, or unlock any Jujutsu Kaisen episode, N7X backend, DRM stream, or third-party media.

## What it does

- `GET /health`: returns a status message
- `GET /demo.mp4`: forwards the original demo video as a stream
- `HEAD /demo.mp4`: forwards metadata
- `GET /demo.mp4` with `Range: bytes=0-1023`: forwards a byte-range request
- Rejects all other paths and foreign website origins; never accepts an arbitrary upstream URL

The Worker forwards data without buffering a whole video. Access still depends on Cloudflare and Firebase being available on the viewer's network.

## Run tests

From the main repository directory:

```bash
npm test
```

## Deploy only when ready

1. Create a **Free** Cloudflare account at https://dash.cloudflare.com/.
2. On a computer with Node.js, open a terminal in `cloudflare-worker/`.
3. Run `npx wrangler login` and complete sign-in in your browser.
4. Run `npx wrangler deploy`. It should show your personal `*.workers.dev` URL.
5. Visit `https://YOUR-WORKER.workers.dev/health` and then `/demo.mp4`.

**Do not deploy this Worker expecting anime playback**: it is an isolated test and the website has not been changed to use it. After the test works on the Chromebook, we can decide whether to connect Cryalune to a video service for which you have explicit access and redistribution/streaming permission.

The Worker does not bypass school network restrictions, remove DRM, or use N7X's live backend.
