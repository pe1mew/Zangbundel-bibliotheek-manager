// SPDX-License-Identifier: Apache-2.0
// The browser check (completion plan C5; rerun for C12 and any release): the manager's key and signing cycle in real
// browsers other than the browser pane's Chromium.
//
//   node webapp/tests/browsers/drive.mjs <edge|firefox|all> <release dir> [--report <file.json>]
//
// It starts serve.py on a free local port (the release with the production CSP, see there), then for each browser:
// starts it headless at 1400 x 900 with a fresh, empty profile in a temp folder; runs cycle.js in the page; presses a
// real F1 in the library's title field; closes the browser and deletes the profile. Edge is driven through the Chrome
// DevTools Protocol, Firefox through WebDriver BiDi, both over Node's built-in WebSocket. It prints one line per step
// and exits 1 when any step fails. Browser paths: $ZBM_EDGE, $ZBM_FIREFOX, or the usual Windows install folders.
// Safari is not covered: it runs only on macOS.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const reportAt = argv.includes('--report') ? argv[argv.indexOf('--report') + 1] : null;
const [which, releaseDir] = argv.filter((a, i) => a !== '--report' && argv[i - 1] !== '--report');
const BROWSERS = {
  edge: process.env.ZBM_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  firefox: process.env.ZBM_FIREFOX || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
};
if (!releaseDir || !(which === 'all' || which in BROWSERS) || !existsSync(join(releaseDir, 'index.html'))) {
  console.error('usage: node drive.mjs <edge|firefox|all> <release dir> [--report <file.json>]');
  process.exit(2);
}
const cycle = readFileSync(join(here, 'cycle.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const F1_CHECK = "JSON.stringify({ focused: document.activeElement && document.activeElement.id, open: !document.getElementById('help-libTitle').hidden, keys: window.__keys })";
const F1_PREPARE = "window.__keys = []; document.addEventListener('keydown', (e) => __keys.push(e.key + (e.defaultPrevented ? ' (prevented)' : ''))); const t = document.getElementById('lib-title'); if (t) t.focus(); document.activeElement && document.activeElement.id";

function rpc(ws) {
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, ko } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) ko(new Error(`${JSON.stringify(msg.error)} ${msg.message || ''}`)); else ok(msg.result);
    }
  });
  return (method, params = {}) => new Promise((ok, ko) => { const n = ++id; waiting.set(n, { ok, ko }); ws.send(JSON.stringify({ id: n, method, params })); });
}
const connect = (url) => new Promise((ok, ko) => { const ws = new WebSocket(url); ws.addEventListener('open', () => ok(ws)); ws.addEventListener('error', ko); });

function startServer() {
  const py = spawn(process.env.PYTHON || 'python', ['-I', join(here, 'serve.py'), resolve(releaseDir)], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((ok, ko) => {
    let buf = '';
    py.stdout.on('data', (d) => { buf += d; const m = buf.match(/PORT (\d+)/); if (m) ok({ py, url: `http://127.0.0.1:${m[1]}/` }); });
    py.on('exit', (code) => ko(new Error(`serve.py exited with ${code}`)));
  });
}

async function edge(url, port) {
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ }
    if (!target) await sleep(200);
  }
  const ws = await connect(target.webSocketDebuggerUrl);
  const call = rpc(ws);
  const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  await call('Page.navigate', { url }); await sleep(1500);
  await evaluate("localStorage.setItem('zbm.lang', 'nl'); 1");
  await call('Page.navigate', { url }); await sleep(2500);
  const report = JSON.parse(await evaluate(cycle));
  await call('Page.bringToFront');
  await evaluate(F1_PREPARE);
  for (const type of ['rawKeyDown', 'keyUp']) await call('Input.dispatchKeyEvent', { type, key: 'F1', code: 'F1', windowsVirtualKeyCode: 112, nativeVirtualKeyCode: 112 });
  await sleep(500);
  report.f1 = JSON.parse(await evaluate(F1_CHECK));
  report.browser = (await evaluate('navigator.userAgent')).match(/Edg\/[\d.]+/)?.[0] || 'Edge';
  ws.close();
  return report;
}

async function firefox(url, port) {
  let ws;
  for (let i = 0; i < 100 && !ws; i++) { try { ws = await connect(`ws://127.0.0.1:${port}/session`); } catch { await sleep(200); } }
  const call = rpc(ws);
  const session = await call('session.new', { capabilities: {} });
  const context = (await call('browsingContext.getTree', {})).contexts[0].context;
  const evaluate = async (expression) => {
    const r = await call('script.evaluate', { expression, target: { context }, awaitPromise: true });
    if (r.type === 'exception') throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  try { await call('browsingContext.setViewport', { context, viewport: { width: 1400, height: 900 } }); } catch { /* older Firefox */ }
  await call('browsingContext.navigate', { context, url, wait: 'complete' });
  await evaluate("localStorage.setItem('zbm.lang', 'nl'); 1");
  await call('browsingContext.navigate', { context, url, wait: 'complete' }); await sleep(1500);
  const report = JSON.parse(await evaluate(cycle));
  await evaluate(F1_PREPARE);
  await call('input.performActions', { context, actions: [{ type: 'key', id: 'kb', actions: [{ type: 'keyDown', value: '\uE031' }, { type: 'keyUp', value: '\uE031' }] }] });
  await sleep(500);
  report.f1 = JSON.parse(await evaluate(F1_CHECK));
  report.browser = `Firefox ${session.capabilities.browserVersion}`;
  try { await call('session.end', {}); } catch { /* closing */ }
  ws.close();
  return report;
}

async function runBrowser(name, url) {
  const port = name === 'edge' ? 9333 : 9334;
  const profile = mkdtempSync(join(tmpdir(), `zbm-c5-${name}-`));
  const args = name === 'edge'
    ? ['--headless=new', '--window-size=1400,900', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank']
    : ['--headless', '--width=1400', '--height=900', `--remote-debugging-port=${port}`, '--profile', profile, '--no-remote', 'about:blank'];
  const proc = spawn(BROWSERS[name], args, { stdio: 'ignore' });
  try {
    const report = await (name === 'edge' ? edge(url, port) : firefox(url, port));
    const f1 = report.f1 || {};
    report.steps.push({ name: 'F1 in a field opens its explanation, not the browser\u2019s help', ok: f1.focused === 'lib-title' && f1.open && (f1.keys || []).includes('F1 (prevented)'), detail: JSON.stringify(f1) });
    report.ok = report.steps.every((s) => s.ok);
    return report;
  } catch (e) {
    return { browser: name, ok: false, steps: [{ name: 'driver', ok: false, detail: String(e && e.message || e) }] };
  } finally {
    proc.kill();
    await sleep(1500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* still held; the temp folder is the OS's */ }
  }
}

const { py, url } = await startServer();
const results = [];
try {
  for (const name of which === 'all' ? Object.keys(BROWSERS) : [which]) {
    const r = await runBrowser(name, url);
    results.push(r);
    console.log(`\n${r.browser || name}${r.webCryptoEd25519 === undefined ? '' : `, Web Crypto Ed25519: ${r.webCryptoEd25519 ? 'yes' : 'no'}`}`);
    for (const s of r.steps) console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.ok ? '' : `\n        ${s.detail}`}`);
  }
} finally {
  py.kill();
}
if (reportAt) writeFileSync(reportAt, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} browsers passed`);
process.exit(failed ? 1 : 0);
