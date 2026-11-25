# Cryalune WebSocket connection test

This is a **standalone diagnostic Worker**. It does not change Cryalune's video
player, does not proxy any website, and is **not a Wisp relay** yet. Its job is
to verify whether a secure WebSocket connection can be established and receive
a response on the devices and networks used for testing.

## Deploy using Google Cloud Shell

From your existing `~/cyralune` checkout:

```bash
cd ~/cyralune
git pull --ff-only origin main
cd cryalune-websocket-test
npx wrangler deploy
```

The deployment creates a separate Worker named `cryalune-websocket-test`.
Your existing `cryalune-media-demo` Worker remains untouched.

Open the newly deployed `https://cryalune-websocket-test.<your-subdomain>.workers.dev/`
URL on your Chromebook and select **Test connection**. You should see either a
clear success message or a connection failure. `/health` returns JSON and can
be used as a basic availability check.

## Interpreting results

- Success proves the browser can open a WebSocket and exchange a short message
  with this Cloudflare Worker. It **does not** prove a full Wisp relay will work.
- A failed connection could be caused by deployment, WebSocket handling,
  origin validation, or network policy. Review the browser console and Worker
  logs rather than attempting to conceal or relabel the endpoint.
- Future work on a Wisp implementation needs a selected compatible browser
  engine, access controls, an explicit destination policy, and further testing.

## Local syntax and response checks

```bash
node --check worker.mjs
node --input-type=module -e "import worker from './worker.mjs'; const r = await worker.fetch(new Request('https://test.invalid/health')); if(r.status!==200 || !(await r.json()).status) process.exit(1);"
```
