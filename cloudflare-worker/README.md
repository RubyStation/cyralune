# Cryalune Cloudflare Worker — isolated media tests

This Worker has two restricted routes: the original Cryalune demo and a full-length Jujutsu Kaisen Episode 1 test sourced from a published GitHub Release MP4. The Worker streams the upstream response; it does not upload or store the full episode in the Worker bundle or Firebase Hosting. Only use media you are authorized to publish and stream.

## What it does

- `GET /health`: returns a status message
- `GET /jjk-test.mp4`: streams the fixed `Jujutsu.Kaisen.TV.Episode.1.mp4` asset from the [`jjk-test` GitHub Release](https://github.com/RubyStation/cyralune/releases/tag/jjk-test). A single byte range is forwarded for seeking; `HEAD` and CORS preflight are supported. There is no fallback for this episode.
- `GET /demo.mp4`: fetches the known Firebase MP4, using the bundled asset if needed
- `HEAD /demo.mp4`: forwards metadata requests to the same two sources
- `GET /demo.mp4` with `Range: bytes=0-1023`: forwards a byte-range request to Firebase (or to Static Assets as a fallback, which currently responds with the small full file, HTTP 200)
- Adds `X-Cryalune-Video-Source: firebase`, `bundled`, or `github-release` to show which source handled the request
- Ignores benign `utm_*` tracking parameters and rejects arbitrary source URLs, other paths and foreign website origins

The Worker forwards the response body without buffering it. GitHub may rate-limit downloads, and neither GitHub Releases nor Cloudflare's ordinary Worker proxy is a guaranteed free host for a full anime library. Cloudflare has restrictions on using its general-purpose network for video delivery; this route is an isolated compatibility test, not a production hosting recommendation. For a sustained library, use a video delivery service that explicitly permits your content and traffic.

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
5. Visit `https://cryalune-media-demo.veniceplays22.workers.dev/health` and then `/jjk-test.mp4` to check the new route.
6. From the repository root, run `firebase deploy --only hosting` to publish the new Cryalune Test tab after pulling the latest `main` branch.
7. Open `https://cryalune.firebaseapp.com/studies.html#test`, select **Test full Episode 1**, and verify playback and seeking on your Chromebook.

The main JJK episode selector has **not** been replaced. The release test appears only in the site's Test tab, alongside both existing clips. The Worker does not remove DRM or access N7X's live backend.
