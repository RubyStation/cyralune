// Isolated Cryalune WebSocket diagnostic. This is not a Wisp relay or a proxy.
// It never fetches remote URLs or opens outgoing network connections.

const TRUSTED_ORIGINS = new Set([
  'https://cryalune.firebaseapp.com',
  'https://cryalune.web.app'
]);

const TEST_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Cryalune · Connection Test</title>
  <style>
    :root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#e7eaf0;background:#080b10}
    *{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px}
    main{width:min(100%,460px);padding:30px;border:1px solid #303642;border-radius:20px;background:#11161e;box-shadow:0 20px 70px #0007}
    .moon{display:block;width:38px;height:23px;border:2px solid #c8ced8;border-bottom:0;border-radius:38px 38px 0 0;margin:0 auto 12px}
    h1{margin:0;text-align:center;letter-spacing:.22em;font-family:Georgia,serif;font-size:30px;font-weight:400}
    .sub{text-align:center;letter-spacing:.15em;text-transform:uppercase;color:#969eae;font-size:11px;margin:8px 0 28px}
    .status{border:1px solid #323a47;border-radius:12px;padding:14px 16px;margin-bottom:16px;color:#d0d6e1;min-height:52px}
    .ok{color:#b2e6c4;border-color:#39674b}.bad{color:#ffc2c2;border-color:#734345}
    button{width:100%;padding:13px 18px;border:0;border-radius:12px;background:#e7eaf0;color:#141821;font-weight:700;cursor:pointer}
    button:disabled{opacity:.5;cursor:wait}
    p{color:#9fa8b7;font-size:13px;line-height:1.55}
    code{color:#d5dbe7;word-break:break-word}
  </style>
</head>
<body>
  <main>
    <span class="moon" aria-hidden="true"></span>
    <h1>CRYALUNE</h1>
    <div class="sub">WebSocket connection test</div>
    <div id="status" class="status" role="status" aria-live="polite">Ready to test.</div>
    <button id="connect" type="button">Test connection</button>
    <p>This test checks whether this browser can establish a secure WebSocket connection to our Cloudflare Worker. It does not load other websites or proxy traffic.</p>
    <p>Endpoint: <code id="endpoint"></code></p>
  </main>
  <script>
    const status = document.getElementById('status');
    const button = document.getElementById('connect');
    const address = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/echo';
    document.getElementById('endpoint').textContent = address;
    button.addEventListener('click', () => {
      button.disabled = true;
      status.className = 'status';
      status.textContent = 'Connecting…';
      const nonce = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      let completed = false;
      let socket;
      let timeout;
      try {
        socket = new WebSocket(address);
        timeout = setTimeout(() => {
          if (!completed) {
            status.className = 'status bad';
            status.textContent = 'Connection timed out.';
            socket.close();
            button.disabled = false;
          }
        }, 10000);
        socket.onopen = () => {
          status.textContent = 'Connected. Waiting for reply…';
          socket.send(JSON.stringify({type:'ping', nonce}));
        };
        socket.onmessage = event => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'pong' && message.nonce === nonce) {
              completed = true;
              clearTimeout(timeout);
              status.className = 'status ok';
              status.textContent = 'Success — secure WebSocket connection and reply both work.';
              button.disabled = false;
              socket.close(1000, 'Test complete');
            }
          } catch { /* Ignore unrecognized replies. */ }
        };
        socket.onerror = () => {
          if (!completed) {
            clearTimeout(timeout);
            status.className = 'status bad';
            status.textContent = 'Connection failed. Check access and browser/network console.';
            button.disabled = false;
          }
        };
        socket.onclose = () => {
          if (!completed && !button.disabled) return;
          if (!completed) {
            clearTimeout(timeout);
            status.className = 'status bad';
            status.textContent = 'Connection closed before the reply arrived.';
            button.disabled = false;
          }
        };
      } catch {
        clearTimeout(timeout);
        status.className = 'status bad';
        status.textContent = 'This browser could not start a WebSocket.';
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

function message(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return message({error:'Method not allowed'}, 405);

    if (url.pathname === '/health') {
      return message({status:'ok', service:'cryalune-websocket-test', wisp:false});
    }

    if (url.pathname === '/') {
      return new Response(TEST_PAGE, {
        headers: {
          'Content-Type':'text/html; charset=utf-8',
          'Cache-Control':'no-store',
          'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' wss:; base-uri 'none'; form-action 'none'",
          'X-Content-Type-Options':'nosniff'
        }
      });
    }

    if (url.pathname !== '/echo') return message({error:'Not found'}, 404);
    const origin = request.headers.get('Origin');
    if (!origin || (origin !== url.origin && !TRUSTED_ORIGINS.has(origin))) {
      return message({error:'Origin not allowed'}, 403);
    }
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return message({error:'WebSocket upgrade required'}, 426);
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    let replies = 0;
    server.addEventListener('message', event => {
      if (typeof event.data !== 'string' || event.data.length > 256 || ++replies > 3) {
        server.close(1008, 'Test limit exceeded');
        return;
      }
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'ping' || typeof payload.nonce !== 'string' || payload.nonce.length > 80) {
          server.close(1008, 'Invalid test message');
          return;
        }
        server.send(JSON.stringify({type:'pong', nonce:payload.nonce}));
      } catch {
        server.close(1008, 'Invalid JSON');
      }
    });
    return new Response(null, {status:101, webSocket:client});
  }
};
