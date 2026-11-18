/**
 * Token Launch Radar — single-file HTTP server + dashboard.
 *
 * Offline by design: the runtime reads the bundled seed dataset
 * (`data/tokens.ts`) and never makes an outbound request. Swap `loadTokens()`
 * for a live feed later; the API and dashboard are source-agnostic.
 *
 * Run: `node main.ts` (Node 22.18+ strips the types), then open
 * http://localhost:PORT — `PORT` defaults to 8000, bound to 127.0.0.1.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { TOKENS, type Token } from './data/tokens.ts';
import { facets, parseFilters, parseSort, rankTokens } from './lib/radar.ts';

const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 8000;
const HOST = '127.0.0.1';

/** Data source seam: the only function a live feed needs to replace. */
function loadTokens(): Token[] {
  return TOKENS;
}

/** Write a JSON response. */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

/** Write the text response. */
function sendText(
  res: ServerResponse,
  status: number,
  body: string,
  type = 'text/plain; charset=utf-8',
): void {
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

/** Handle one request. Exported so it can be exercised without binding a port. */
export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    const tokens = loadTokens();

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      sendText(res, 200, DASHBOARD_HTML, 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname === '/api/tokens') {
      const nowSec = Math.floor(Date.now() / 1000);
      const filters = parseFilters(url.searchParams);
      const sort = parseSort(url.searchParams);
      const ranked = rankTokens(tokens, nowSec, filters, sort);
      sendJson(res, 200, {
        source: 'offline-demo',
        now: nowSec,
        total: tokens.length,
        count: ranked.length,
        filters,
        sort,
        facets: facets(tokens),
        tokens: ranked,
      });
      return;
    }

    sendJson(res, 404, { error: 'not_found', path: url.pathname });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    sendJson(res, 500, { error: 'internal_error', message });
  }
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Token Launch Radar</title>
<style>
  :root {
    --bg: #070b12; --panel: #0d131d; --panel2: #111a26; --line: #1c2837;
    --fg: #dbe6f3; --dim: #7d8ea3; --accent: #22e08a; --accent2: #35c8ff;
    --warn: #ffb020; --bad: #ff4f6d; --hot: #ff7a45;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  header {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    padding: 16px 22px; border-bottom: 1px solid var(--line);
    background: radial-gradient(1200px 120px at 20% -40%, #123a2c 0%, transparent 70%), var(--panel);
  }
  h1 { font-size: 16px; letter-spacing: 3px; margin: 0; font-weight: 700; }
  h1 span { color: var(--accent); }
  .pill {
    font-size: 11px; letter-spacing: 1px; padding: 3px 10px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--dim); background: #0a1017;
  }
  .pill.live { color: var(--accent); border-color: #1d5f43; background: #0b1f18; }
  .pill.radar::before {
    content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 7px;
    border-radius: 50%; background: var(--accent); vertical-align: middle;
    box-shadow: 0 0 0 0 rgba(34,224,138,.7); animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(34,224,138,.6); }
    70% { box-shadow: 0 0 0 9px rgba(34,224,138,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,224,138,0); }
  }
  .spacer { flex: 1; }
  main { padding: 16px 22px 40px; }
  .controls {
    display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;
    padding: 14px; border: 1px solid var(--line); border-radius: 10px;
    background: var(--panel); margin-bottom: 14px;
  }
  label { display: block; font-size: 10px; letter-spacing: 1.2px; color: var(--dim); margin-bottom: 5px; text-transform: uppercase; }
  select, input[type=text], input[type=number] {
    background: var(--panel2); color: var(--fg); border: 1px solid var(--line);
    border-radius: 7px; padding: 7px 9px; font: inherit; min-width: 140px;
  }
  input[type=text] { min-width: 190px; }
  select:focus, input:focus { outline: 1px solid var(--accent2); }
  .check { display: flex; align-items: center; gap: 8px; padding: 7px 2px; }
  .check input { accent-color: var(--bad); width: 15px; height: 15px; }
  .check span { font-size: 11px; letter-spacing: .6px; }
  button {
    background: var(--panel2); color: var(--fg); border: 1px solid var(--line);
    border-radius: 7px; padding: 8px 14px; font: inherit; cursor: pointer;
  }
  button:hover { border-color: var(--accent); color: var(--accent); }
  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .stat {
    flex: 1 1 150px; border: 1px solid var(--line); border-radius: 10px;
    background: var(--panel); padding: 10px 14px;
  }
  .stat b { display: block; font-size: 19px; margin-top: 3px; }
  .stat u { text-decoration: none; font-size: 10px; letter-spacing: 1.2px; color: var(--dim); text-transform: uppercase; }
  .tablewrap { border: 1px solid var(--line); border-radius: 10px; overflow: auto; background: var(--panel); }
  table { border-collapse: collapse; width: 100%; min-width: 1080px; }
  th, td { padding: 8px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
  th { position: sticky; top: 0; background: #0b111a; font-size: 10px; letter-spacing: 1.1px; color: var(--dim); text-transform: uppercase; cursor: pointer; user-select: none; z-index: 2; }
  th:hover { color: var(--accent2); }
  th.sorted { color: var(--accent); }
  th:first-child, td:first-child { text-align: left; }
  tbody tr:hover { background: #101a27; }
  tbody tr:last-child td { border-bottom: 0; }
  tr.rugged td { background: rgba(255,79,109,.07); color: #c9a3ab; }
  tr.fresh td:first-child { box-shadow: inset 2px 0 0 var(--accent); }
  tr.fresh td { background: rgba(34,224,138,.05); }
  .tok { display: flex; align-items: center; gap: 9px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .sym { font-weight: 700; }
  .name { color: var(--dim); font-size: 11px; }
  .tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--line); color: var(--dim); }
  .tag.new { color: var(--accent); border-color: #1d5f43; }
  .tag.rug { color: var(--bad); border-color: #66303c; background: #221016; }
  .score { font-weight: 700; color: var(--accent); }
  .bars { width: 130px; }
  .bar { height: 5px; border-radius: 3px; background: #18222f; overflow: hidden; margin: 2px 0; }
  .bar i { display: block; height: 100%; }
  .bar.score i { background: linear-gradient(90deg, #1f9e6a, #22e08a); }
  .bar.heat i { background: linear-gradient(90deg, #1c6f9e, #35c8ff); }
  .bar.press i.b { background: var(--accent); }
  .bar.press i.s { background: var(--bad); }
  .pressure { display: flex; height: 5px; border-radius: 3px; overflow: hidden; background: #18222f; margin: 2px 0; }
  .pressure i { display: block; height: 100%; }
  .pressure i.b { background: var(--accent); }
  .pressure i.s { background: var(--bad); }
  .muted { color: var(--dim); }
  .empty { padding: 30px; text-align: center; color: var(--dim); }
  footer { padding: 14px 22px 30px; color: var(--dim); font-size: 11px; }
  footer code { color: var(--fg); }
</style>
</head>
<body>
<header>
  <h1>TOKEN LAUNCH <span>RADAR</span></h1>
  <span class="pill radar">SCANNING</span>
  <span class="pill live">OFFLINE DEMO FEED</span>
  <span class="spacer"></span>
  <span class="pill" id="clock">--:--:--</span>
  <button id="refresh" type="button">Refresh</button>
</header>
<main>
  <div class="controls">
    <div><label for="chain">Chain</label><select id="chain"><option value="">All chains</option></select></div>
    <div><label for="launchpad">Launchpad / pool</label><select id="launchpad"><option value="">All launchpads</option></select></div>
    <div><label for="minliq">Min liquidity</label>
      <select id="minliq">
        <option value="0">Any</option>
        <option value="10000">$10K+</option>
        <option value="50000">$50K+</option>
        <option value="100000">$100K+</option>
        <option value="500000">$500K+</option>
      </select>
    </div>
    <div><label for="q">Search</label><input id="q" type="text" placeholder="name or symbol"></div>
    <label class="check"><input id="nodug" type="checkbox"><span>Hide rug risk</span></label>
    <div><label for="sortsel">Sort</label>
      <select id="sortsel">
        <option value="score:desc">Radar score</option>
        <option value="age:asc">Newest first</option>
        <option value="liquidity:desc">Liquidity</option>
        <option value="volume:desc">Volume 24h</option>
        <option value="market_cap:desc">Market cap</option>
        <option value="hype:desc">Hype</option>
        <option value="holders:desc">Holders</option>
        <option value="buys:desc">Buys</option>
      </select>
    </div>
    <div class="spacer"></div>
    <button id="reset" type="button">Reset</button>
  </div>

  <div class="stats">
    <div class="stat"><u>Tracked</u><b id="s-count">-</b></div>
    <div class="stat"><u>Fresh &lt; 1h</u><b id="s-fresh">-</b></div>
    <div class="stat"><u>Total liquidity</u><b id="s-liq">-</b></div>
    <div class="stat"><u>Volume 24h</u><b id="s-vol">-</b></div>
    <div class="stat"><u>Rug risk</u><b id="s-rug">-</b></div>
  </div>

  <div class="tablewrap">
    <table>
      <thead><tr id="head"></tr></thead>
      <tbody id="body"></tbody>
    </table>
  </div>
</main>
<footer>
  Offline demo feed — <span id="f-total">?</span> seeded launches, scored as
  <code>0.35*liq + 0.30*vol + 0.35*hype - age_penalty</code> (48h window).
  Live source swap point: <code>loadTokens()</code> in <code>main.ts</code>.
</footer>
<script>
'use strict';
var COLUMNS = [
  { key: 'token', label: 'Token', sortable: false },
  { key: 'launchpad', label: 'Launchpad', sortable: false },
  { key: 'age', label: 'Age', sortable: true },
  { key: 'liquidity', label: 'Liquidity', sortable: true },
  { key: 'volume', label: 'Vol 24h', sortable: true },
  { key: 'market_cap', label: 'Mkt cap', sortable: true },
  { key: 'holders', label: 'Holders', sortable: true },
  { key: 'pressure', label: 'Buy/Sell', sortable: true },
  { key: 'hype', label: 'Hype', sortable: true },
  { key: 'score', label: 'Radar score', sortable: true }
];
var CHAIN_COLORS = { SOL: '#14f195', ETH: '#8a92b2', BNB: '#f0b90b', BASE: '#0052ff', ARB: '#28a0f0', SUI: '#4da2ff' };
var state = { sort: 'score', dir: 'desc', tokens: [], facets: null };

function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function usd(n) {
  if (!isFinite(n)) return '-';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}
function num(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

function query() {
  var p = new URLSearchParams();
  if (el('chain').value) p.set('chain', el('chain').value);
  if (el('launchpad').value) p.set('launchpad', el('launchpad').value);
  if (Number(el('minliq').value) > 0) p.set('min_liquidity', el('minliq').value);
  if (el('q').value.trim()) p.set('q', el('q').value.trim());
  if (el('nodug').checked) p.set('no_rugged', '1');
  p.set('sort', state.sort);
  p.set('dir', state.dir);
  return p.toString();
}

function fillFacets(f) {
  if (state.facets) return;
  state.facets = f;
  var c = el('chain'), l = el('launchpad');
  f.chains.forEach(function (v) { c.add(new Option(v, v)); });
  f.launchpads.forEach(function (v) { l.add(new Option(v, v)); });
}

// Dashboard state lives in the URL, so any view is shareable and screenshot-able.
function hydrate() {
  var p = new URLSearchParams(location.search);
  if (p.get('chain')) el('chain').value = p.get('chain');
  if (p.get('launchpad')) el('launchpad').value = p.get('launchpad');
  if (p.get('min_liquidity')) el('minliq').value = p.get('min_liquidity');
  if (p.get('q')) el('q').value = p.get('q');
  if (p.get('no_rugged')) el('nodug').checked = true;
  if (p.get('sort')) {
    state.sort = p.get('sort');
    state.dir = p.get('dir') === 'asc' ? 'asc' : 'desc';
    el('sortsel').value = state.sort + ':' + state.dir;
    if (!el('sortsel').value) { state.sort = 'score'; state.dir = 'desc'; el('sortsel').value = 'score:desc'; }
  }
  syncUrl();
}

// Skipped until the first response, which would otherwise erase the entry URL.
function syncUrl() {
  if (!state.facets) return;
  history.replaceState(null, '', location.pathname + (query() ? '?' + query() : ''));
}

function load() {
  syncUrl();
  fetch('/api/tokens?' + query())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      if (!state.facets) {
        fillFacets(d.facets);
        hydrate();
        if (location.search.length > 1) { load(); return; }
      }
      state.tokens = d.tokens;
      el('f-total').textContent = d.total;
      render(d);
    })
    .catch(function (e) {
      el('body').innerHTML = '<tr><td colspan="10" class="empty">Feed error: ' + esc(e.message) + '</td></tr>';
    });
}

function render(d) {
  var t = d.tokens;
  el('s-count').textContent = t.length;
  el('s-fresh').textContent = t.filter(function (x) { return x.age_seconds < 3600; }).length;
  el('s-liq').textContent = usd(t.reduce(function (a, x) { return a + x.liquidity_usd; }, 0));
  el('s-vol').textContent = usd(t.reduce(function (a, x) { return a + x.volume_24h_usd; }, 0));
  el('s-rug').textContent = t.filter(function (x) { return x.rugged; }).length;

  el('head').innerHTML = COLUMNS.map(function (c) {
    var mark = state.sort === c.key || (c.key === 'pressure' && state.sort === 'buys');
    var arrow = mark ? (state.dir === 'asc' ? ' \\u25b2' : ' \\u25bc') : '';
    return '<th data-key="' + c.key + '" data-sortable="' + (c.sortable ? '1' : '0') + '"' +
      (mark ? ' class="sorted"' : '') + '>' + c.label + arrow + '</th>';
  }).join('');

  if (!t.length) {
    el('body').innerHTML = '<tr><td colspan="10" class="empty">No launches match these filters.</td></tr>';
    return;
  }

  el('body').innerHTML = t.map(function (x, i) {
    var fresh = x.age_seconds < 3600;
    var total = Math.max(1, x.buys + x.sells);
    var buyPct = (x.buys / total) * 100;
    var scoreW = Math.max(2, x.score);
    var lpad = x.launchpad === 'Uniswap V3' || x.launchpad === 'Uniswap V4' ? 'Uni ' + x.launchpad.slice(8) : x.launchpad;
    return '<tr class="' + (x.rugged ? 'rugged' : '') + (fresh ? ' fresh' : '') + '">' +
      '<td><div class="tok"><span class="dot" style="background:' + (CHAIN_COLORS[x.chain] || '#666') + '"></span>' +
        '<span class="sym">' + esc(x.symbol) + '</span><span class="name">' + esc(x.name) + '</span>' +
        '<span class="tag">' + esc(x.chain) + '</span>' +
        (fresh ? '<span class="tag new">NEW</span>' : '') +
        (x.rugged ? '<span class="tag rug">RUG RISK</span>' : '') +
      '</div></td>' +
      '<td class="muted">' + esc(lpad) + '</td>' +
      '<td class="' + (fresh ? '' : 'muted') + '">' + esc(x.age_label) + '</td>' +
      '<td>' + usd(x.liquidity_usd) + '</td>' +
      '<td>' + usd(x.volume_24h_usd) + '</td>' +
      '<td>' + usd(x.market_cap_usd) + '</td>' +
      '<td>' + num(x.holders) + '</td>' +
      '<td><div class="bars"><div class="pressure"><i class="b" style="width:' + buyPct.toFixed(0) + '%"></i><i class="s" style="width:' + (100 - buyPct).toFixed(0) + '%"></i></div>' +
        '<div class="name">' + num(x.buys) + 'B / ' + num(x.sells) + 'S</div></div></td>' +
      '<td><div class="bars"><div class="bar heat"><i style="width:' + x.hype_score + '%"></i></div></div></td>' +
      '<td><span class="score">' + x.score.toFixed(1) + '</span><div class="bars"><div class="bar score"><i style="width:' + scoreW.toFixed(0) + '%"></i></div></div></td>' +
    '</tr>';
  }).join('');
}

el('head').addEventListener('click', function (e) {
  var th = e.target.closest('th');
  if (!th || th.dataset.sortable !== '1') return;
  var key = th.dataset.key;
  if (state.sort === key) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
  else { state.sort = key; state.dir = key === 'age' ? 'asc' : 'desc'; }
  el('sortsel').value = state.sort + ':' + state.dir;
  load();
});

['chain', 'launchpad', 'minliq'].forEach(function (id) { el(id).addEventListener('change', load); });
el('nodug').addEventListener('change', load);
var debounce;
el('q').addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(load, 220); });
el('sortsel').addEventListener('change', function () {
  var parts = el('sortsel').value.split(':');
  state.sort = parts[0]; state.dir = parts[1];
  load();
});
el('refresh').addEventListener('click', load);
el('reset').addEventListener('click', function () {
  el('chain').value = ''; el('launchpad').value = ''; el('minliq').value = '0';
  el('q').value = ''; el('nodug').checked = false;
  state.sort = 'score'; state.dir = 'desc'; el('sortsel').value = 'score:desc';
  load();
});
setInterval(function () { el('clock').textContent = new Date().toLocaleTimeString(); }, 1000);
setInterval(load, 20000);
load();
</script>
</body>
</html>
`;

const server = createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`Token Launch Radar (offline demo feed, ${TOKENS.length} launches)`);
  console.log(`Dashboard: http://${HOST}:${PORT}/`);
  console.log(`API:       http://${HOST}:${PORT}/api/tokens`);
});
