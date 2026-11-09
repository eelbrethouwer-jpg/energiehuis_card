'use strict';
/*
 * PVE-04 · prestatiemeting maskering (Chromium + CDP).
 *   node preview/pve-04/tests/perf.cjs [--runs=3] [--seconds=3] [--write]
 *
 * Identieke omstandigheden voor alle varianten: één lokale HTTP-server (preview/), headless Chromium,
 * viewport 1440×900 (desktop) en 390×844 (mobiel), DPR 1, scenario "praktijk-sim" (4 actieve routes),
 * schommeling uit (?ticker=0), CPU-throttling 1× en 4× via CDP. Per meting N runs; fps = mediaan over runs,
 * p95 = 95e percentiel van alle frametijden (requestAnimationFrame-delta's).
 *
 * Varianten: PVE-03 (nulmeting) · PVE-04 placeholder full/bbox/css · PVE-04 master (standaard sinds de master-cockpit).
 * Doelen voor de standaardvariant bij 4×: ≥ 50 fps = DOEL, 45–49 = WAARSCHUWING, < 45 = DOEL NIET GEHAALD,
 * < 30 fps = harde FOUT (exit 1). p95 ≤ 33 ms = doel (anders WAARSCHUWING).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), __dirname] }));

const ROOT = path.join(__dirname, '..', '..');                // preview/
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const RUNS = arg('runs', 3), SECONDS = arg('seconds', 3), WRITE = process.argv.includes('--write');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(ROOT, u);
      if (!path.resolve(file).startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const VARIANTS = [
  { id: 'pve03', url: '/pve-03/index.html?ticker=0&scenario=praktijk-sim' },
  { id: 'pve04-full', url: '/pve-04/index.html?ticker=0&scenario=praktijk-sim&maskmode=full&scene=placeholder' },
  { id: 'pve04-bbox', url: '/pve-04/index.html?ticker=0&scenario=praktijk-sim&maskmode=bbox&scene=placeholder' },
  { id: 'pve04-css', url: '/pve-04/index.html?ticker=0&scenario=praktijk-sim&maskmode=css&scene=placeholder' },
  { id: 'pve04-bbox-nosvg', url: '/pve-04/index.html?ticker=0&scenario=praktijk-sim&maskmode=bbox&svgmask=0&scene=placeholder' },
  { id: 'pve04-master', url: '/pve-04/index.html?ticker=0&scenario=praktijk-sim', default: true }
];
const VIEWPORTS = [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }];
const RATES = [1, 4];

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const median = arr => pct(arr, 50);

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const results = [];
  for (const vp of VIEWPORTS) for (const rate of RATES) for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + v.url);
    await page.waitForFunction(() => { const i = document.querySelector('.ehc-scene img, img.ehm-scene'); const e = document.querySelector('.ehc'); return i && i.complete && i.naturalWidth > 0 && e.dataset.quiet !== 'pending'; });
    await page.waitForTimeout(800);
    const mode = await page.evaluate(() => { const f = window.__cockpits[0].flows; return f && f.maskInfo ? f.maskInfo().effectiveMode : (window.__cockpits[0].particleInfo ? 'master' : 'geen masker'); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(300);
    const fpsRuns = [], frames = [];
    for (let r = 0; r < RUNS; r++) {
      const d = await page.evaluate(ms => new Promise(res => { const t = []; let last = performance.now(); const t0 = last; const f = now => { t.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); }), SECONDS * 1000);
      const dts = d.slice(1); fpsRuns.push(1000 / (dts.reduce((a, b) => a + b, 0) / dts.length)); frames.push(...dts);
    }
    await ctx.close();
    results.push({ viewport: vp.id, rate, variant: v.id, default: !!v.default, mode, fps: +median(fpsRuns).toFixed(1), fpsRuns: fpsRuns.map(x => +x.toFixed(1)), p95ms: +pct(frames, 95).toFixed(1), errors });
  }
  await browser.close(); srv.close();

  // Vergelijking met PVE-03 en beoordeling
  let hardFail = false;
  const lines = ['viewport  CPU  variant      modus         fps (runs)              p95 ms   Δfps t.o.v. PVE-03   beoordeling'];
  for (const r of results) {
    const ref = results.find(x => x.viewport === r.viewport && x.rate === r.rate && x.variant === 'pve03');
    r.deltaPct = +(((r.fps - ref.fps) / ref.fps) * 100).toFixed(1);
    if (r.default && r.rate === 4) {
      r.verdict = r.fps < 30 ? 'FOUT (< 30 fps)' : r.fps < 45 ? 'DOEL NIET GEHAALD (< 45 fps)' : r.fps < 50 ? 'WAARSCHUWING (45–49 fps)' : 'DOEL (≥ 50 fps)';
      if (r.p95ms > 33) r.verdict += ' · p95 > 33 ms WAARSCHUWING'; else r.verdict += ' · p95 ≤ 33 ms';
      if (r.fps < 30) hardFail = true;
    } else r.verdict = r.default ? 'standaard (1×: informatief)' : '';
    if (r.errors.length) { r.verdict += ' · JS-FOUT'; hardFail = true; }
    lines.push(`${r.viewport.padEnd(9)} ${String(r.rate + '×').padEnd(4)} ${r.variant.padEnd(12)} ${String(r.mode).padEnd(13)} ${String(r.fps).padStart(5)} (${r.fpsRuns.join(', ')})`.padEnd(66) + `${String(r.p95ms).padStart(6)}   ${(r.deltaPct > 0 ? '+' : '') + r.deltaPct}%`.padEnd(26) + r.verdict);
  }
  console.log(lines.join('\n'));
  if (WRITE) {
    const out = path.join(__dirname, '..', 'screenshots', 'perf.json');
    fs.writeFileSync(out, JSON.stringify({ conditions: { browser: 'chromium headless', runs: RUNS, seconds: SECONDS, dpr: 1, scenario: 'praktijk-sim', ticker: false }, results }, null, 2) + '\n');
    console.log('geschreven: ' + path.relative(process.cwd(), out));
  }
  process.exit(hardFail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
