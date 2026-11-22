import { normalizeAddress } from './address.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const viewport = $('viewport');
const input = $('address');
const tabStrip = $('tabs');
const tabs = [];
let selected = null;
let controller;
let ready = false;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

function redrawTabs() {
  tabStrip.replaceChildren();
  for (const tab of tabs) {
    const node = document.createElement('button');
    node.className = 'tab' + (tab === selected ? ' active' : '');
    node.role = 'tab';
    node.ariaSelected = String(tab === selected);
    const label = document.createElement('span');
    label.textContent = tab.label;
    label.className = 'tab-label';
    node.append(label);
    node.addEventListener('click', () => selectTab(tab));
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close tab';
    close.addEventListener('click', (event) => { event.stopPropagation(); closeTab(tab); });
    node.append(close);
    tabStrip.append(node);
  }
}

function selectTab(tab) {
  selected = tab;
  for (const entry of tabs) {
    if (entry.frame) entry.frame.style.display = entry === tab ? 'block' : 'none';
  }
  $('welcome').hidden = Boolean(tab.frame);
  input.value = tab.url ?? '';
  redrawTabs();
}

function newTab() {
  const tab = { url: '', label: 'New tab', frame: null, proxy: null };
  tabs.push(tab);
  selectTab(tab);
  input.focus();
  return tab;
}

function closeTab(tab) {
  const index = tabs.indexOf(tab);
  if (index < 0) return;
  tab.frame?.remove();
  tabs.splice(index, 1);
  if (!tabs.length) newTab();
  else if (tab === selected) selectTab(tabs[Math.min(index, tabs.length - 1)]);
  else redrawTabs();
}

async function setup() {
  if (!globalThis.$scramjetLoadController || !globalThis.BareMux) {
    throw new Error('Scramjet files were not found. Install dependencies first.');
  }
  if (!navigator.serviceWorker) throw new Error('This browser does not allow service workers. Use HTTPS or localhost.');
  const { ScramjetController } = $scramjetLoadController();
  controller = new ScramjetController({ files: {
    wasm: '/scram/scramjet.wasm.wasm',
    all: '/scram/scramjet.all.js',
    sync: '/scram/scramjet.sync.js',
  } });
  await controller.init();
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const transport = new BareMux.BareMuxConnection('/baremux/worker.js');
  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const relayUrl = `${wsProtocol}://${location.host}/wisp/`;
  await transport.setTransport('/libcurl/index.mjs', [{ websocket: relayUrl }]);
  ready = true;
  setStatus('Ready · Wisp transport configured. Enter a public website above.');
}

async function navigate(rawAddress) {
  if (!ready) return setStatus('Browser relay is still initializing.', true);
  const url = normalizeAddress(rawAddress);
  if (!url) return setStatus('Type a website address or search.', true);
  const tab = selected ?? newTab();
  try {
    if (!tab.proxy) {
      tab.proxy = controller.createFrame();
      tab.frame = tab.proxy.frame;
      tab.frame.classList.add('proxy-frame');
      tab.frame.title = 'Proxied browser page';
      tab.frame.addEventListener('load', () => setStatus(`Page loaded · ${tab.label}`));
      viewport.append(tab.frame);
    }
    tab.url = url;
    tab.label = new URL(url).hostname;
    selectTab(tab);
    $('welcome').hidden = true;
    setStatus(`Opening ${tab.label}…`);
    await tab.proxy.go(url);
  } catch (error) {
    setStatus(`Could not open page: ${error.message}`, true);
  }
}

$('address-form').addEventListener('submit', (event) => {
  event.preventDefault();
  navigate(input.value);
});

$('new-tab').addEventListener('click', newTab);
$('try-example').addEventListener('click', () => navigate('https://example.com/'));
$('reload').addEventListener('click', () => {
  if (selected?.url) navigate(selected.url);
});

for (const [name, direction] of [['back', 'back'], ['forward', 'forward']]) {
  $(name).addEventListener('click', () => {
    try { selected?.frame?.contentWindow?.history?.[direction](); }
    catch { setStatus('History controls are unavailable for this page.', true); }
  });
}

newTab();
setup().catch((error) => setStatus(`Setup failed: ${error.message}`, true));
