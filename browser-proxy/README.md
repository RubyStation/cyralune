# Cryalune Browser Relay Lab (separate prototype)

This is a **standalone, self-hosted Scramjet browser frontend with a Wisp WebSocket backend**. It is intentionally separate from the live Cryalune anime site. Nothing in this folder is deployed by Firebase Hosting or the existing Cloudflare demo Worker.

The browser rewrites websites with [Mercury Workshop Scramjet v2](https://github.com/MercuryWorkshop/scramjet), uses its new controller plus [libcurl-transport v2](https://github.com/MercuryWorkshop/libcurl-transport) for networking, and connects via [wisp-js](https://github.com/MercuryWorkshop/wisp-js) over `/wisp/`. BareMux is part of the old Scramjet v1 integration and is deliberately **not** mixed with the v2 controller. The packages and their own open-source licenses are third-party dependencies; consult their license terms before public deployment, including the AGPL terms of Scramjet and libcurl-transport.

## Run locally for free

Requires **Node.js 20 or later**, npm, and network access for one-time dependency installation:

```sh
cd browser-proxy
npm ci --ignore-scripts
npm start
```

The Scramjet v2, controller, and libcurl v2 packages are pinned to exact npm versions. `--ignore-scripts` avoids executing dependency install scripts. The lockfile pins all transitive dependencies.

Open `http://localhost:8789` in a modern desktop browser. The server binds only to `127.0.0.1` by default. Enter `https://example.com` and press Go. If the browser disallows service workers, the relay cannot operate. In particular, a restricted Chromebook may not permit these prerequisites.

## Private remote deployment

An internet-accessible deployment requires an **always-running Node server** and **HTTPS** (via a reverse proxy). Set the following before starting it:

```sh
LISTEN_HOST=0.0.0.0 PORT=8789 PUBLIC_ORIGIN=https://your-actual-domain.example PROXY_ACCESS_TOKEN='YOUR_LONG_RANDOM_TOKEN' npm start
```

Replace the example domain and token. Never commit real tokens to GitHub. Configure the HTTPS reverse proxy to forward WebSocket upgrades to `/wisp/` as well as ordinary requests. The login page requires a high-entropy access token and sets a six-hour HttpOnly, SameSite=Strict session cookie. The server rejects browser requests explicitly marked `Sec-Fetch-Site: cross-site`, without requiring an unchanged Origin header for login (authenticated Cloud Shell preview proxies may rewrite it). There is an in-memory limit of five unsuccessful logins per IP per 15 minutes. **WebSocket upgrades still require an exact Origin match and a valid session cookie.** The Wisp library disables UDP, direct IP destinations, private/loopback IPs, and non-web ports, and caps concurrent streams. **These are basic defenses, not a comprehensive security audit.** Apply access restrictions and operational monitoring before public use.

### Temporary Google Cloud Shell test

Cloud Shell Web Preview can expose port 8080 on an HTTPS address tied to your Google account. It is **temporary testing only**, and its proxy may not pass every WebSocket feature. After installing dependencies, in the same Cloud Shell terminal:

```sh
export PROXY_ACCESS_TOKEN="$(openssl rand -hex 24)"
printf 'Private login token: %s\n' "$PROXY_ACCESS_TOKEN"
LISTEN_HOST=0.0.0.0 PORT=8080 PUBLIC_ORIGIN="https://8080-${WEB_HOST}" npm start
```

Keep the printed token private. Select **Web Preview → Preview on port 8080**, sign in with that token, and first try `https://example.com`. Use Ctrl+C to stop the process. Google ends inactive Cloud Shell sessions, so this is not a 24/7 server.

The default local mode has no password because it only listens on the loopback interface. Do not make it public without the token and HTTPS. Browser page content and destination URLs are visible to the relay host; it is not an anonymity service.

## Why this is not running on our Cloudflare Worker

The [Mercury Workshop Wisp-on-Workers implementation](https://github.com/MercuryWorkshop/wisp-server-workers) explicitly says it is meant for *small API clients* without many parallel/open connections. Full Scramjet browsing involves more simultaneous requests. Therefore **the existing restricted Cloudflare Worker is deliberately untouched**, and this full-browser prototype uses Node. Porting this to Cloudflare Workers may be possible but is an additional experimental project, not a confirmed free drop-in.

## What it can and cannot do

- Provides a browser address bar, search, tabs, forward/back (where browser history permits), reload, proxy service worker, and an authenticated Wisp relay on the same origin.
- Does **not** supply or locate JJK or any other anime episodes; does not reuse N7X's backend or infrastructure; does not bypass DRM.
- Some web apps, logins, streaming sites, CAPTCHAs, live media, and features dependent on browser security isolation will not work even with Scramjet. A school or network administrator may also block the proxy itself; follow applicable network rules.
- This version is a prototype pending end-to-end tests on a host with access to the third-party packages and on your Chromebook. Tests in `test/` check the local security and URL behavior; passing tests do not certify universal website compatibility.

**Verification so far:** the v2 dependencies installed, the Node server launched, the Scramjet v2/controller/libcurl assets served HTTP 200, and Wisp WebSocket upgrades rejected anonymous sessions but accepted authenticated ones. Actual page rewriting in a graphical browser remains unverified because the available headless Chromium runtime cannot create its required local process sockets in this environment. Confirm it in an ordinary browser before treating this as a working playback service.

Run unit tests with `npm test` (the tests themselves use built-in Node tools).

## Next step for Cryalune

Prove normal authorized public websites load in the isolated app on a network where the relay is allowed, then separately test *authorized* video files/streams. N7X's public static distribution uses a separate Wisp VPS, but directly copying its cross-origin open-relay design would remove our private authentication. In this version the browser UI and Wisp endpoint remain **same-origin** to preserve the signed-in session. CDN distribution and a separately hosted authenticated relay require a carefully designed credential flow and infrastructure, not just changing a JavaScript URL. Keep the existing backup branch and the live Cryalune deployment unchanged until playback is confirmed.
