'use strict';
/*
 * PVE-04 · browseracceptatie (Playwright + Chromium).
 *   node preview/pve-03/tests/browser.cjs               # alle controles
 *   node preview/pve-03/tests/browser.cjs --screenshots # idem + screenshots naar preview/pve-03/screenshots/
 * Exit-code 0 = alle controles geslaagd. Elke controle print PASS/FAIL met meetwaarden.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), __dirname] }));

const DIR = path.join(__dirname, '..');
const SHOTS = path.join(DIR, 'screenshots');
const WANT_SHOTS = process.argv.includes('--screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };

let served = [];
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(DIR, u === '/' ? 'index.html' : u);
      if (!path.resolve(file).startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      const buf = fs.readFileSync(file);
      served.push({ path: u, bytes: buf.length });
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const results = [];
let failed = 0;
async function check(name, fn) {
  try { const info = await fn(); results.push({ name, ok: true, info }); console.log('PASS', name, info ? JSON.stringify(info) : ''); }
  catch (e) { failed++; results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '-', process.env.EH_VERBOSE ? e.message : e.message.split('\n')[0]); }
}

// Instrumentatie vóór het laden: houdt open intervals en rAF-callbacks bij.
const INSTRUMENT = () => {
  const live = { intervals: new Set(), rafs: new Set() };
  const si = window.setInterval, ci = window.clearInterval, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setInterval = function (...a) { const id = si.apply(this, a); live.intervals.add(id); return id; };
  window.clearInterval = function (id) { live.intervals.delete(id); return ci.call(this, id); };
  window.requestAnimationFrame = function (cb) { let id; id = ra.call(this, t => { live.rafs.delete(id); cb(t); }); live.rafs.add(id); return id; };
  window.cancelAnimationFrame = function (id) { live.rafs.delete(id); return ca.call(this, id); };
  window.__live = live;
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.message)));
};

async function open(browser, base, { width, height, query = '', reducedMotion = 'no-preference', dpr = 1, route = null, waitImage = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INSTRUMENT);
  if (route) await page.route(route.pattern, r => r.fulfill({ status: 404, body: '' }));
  await page.goto(base + '/index.html' + query);
  if (waitImage) await page.waitForFunction(() => { const i = document.querySelector('.ehc-scene img'); return i && i.complete && i.naturalWidth > 0 && document.querySelector('.ehc').dataset.mask !== 'none'; });
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

// Layoutmetingen in de pagina
const MEASURE = () => {
  const r = e => e.getBoundingClientRect();
  const root = document.querySelector('.ehc'), stage = root.querySelector('.ehc-stage'), sr = r(stage);
  const tiles = [...root.querySelectorAll('.tile')].map(b => {
    const v = b.querySelector('.t-value'), t = b.querySelector('.t-title');
    const br = r(b);
    return { key: b.dataset.key, x: br.left, y: br.top, w: br.width, h: br.height, right: br.right, bottom: br.bottom,
      valueClipped: v.scrollWidth > v.clientWidth + 1, titleClipped: t.scrollWidth > t.clientWidth + 1, value: v.textContent };
  });
  const overlaps = [];
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
    const a = tiles[i], b = tiles[j];
    if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1) overlaps.push(a.key + '/' + b.key);
  }
  const outside = tiles.filter(t => t.x < sr.left - 1 || t.right > sr.right + 1 || t.y < sr.top - 1 || t.bottom > sr.bottom + 1).map(t => t.key);
  const img = stage.querySelector('img');
  return {
    layout: root.dataset.layout, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight,
    tiles, overlaps, outside, small: tiles.filter(t => t.w < 48 || t.h < 48).map(t => t.key),
    clipped: tiles.filter(t => t.valueClipped || t.titleClipped).map(t => t.key),
    belowFold: tiles.filter(t => t.bottom > innerHeight).map(t => t.key),
    src: img.currentSrc.split('/').pop(), stage: { w: sr.width, h: sr.height }
  };
};

(async () => {
  if (WANT_SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  console.log('Chromium', browser.version());
  const metrics = { chromium: browser.version(), viewports: {} };

  // ---------------------------------------------------------------- viewports
  const VIEWPORTS = [[320, 700, 'mobile'], [390, 844, 'mobile'], [768, 1024, 'desktop'], [1330, 748, 'desktop'], [1440, 900, 'desktop']];
  for (const [w, h, layout] of VIEWPORTS) {
    await check(`viewport ${w}x${h}: layout, geen overflow/overlap/afkapping, targets ≥48px, geen consolefouten`, async () => {
      served = [];
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0', dpr: WANT_SHOTS ? 2 : 1 });
      const m = await page.evaluate(MEASURE);
      if (WANT_SHOTS) await page.screenshot({ path: path.join(SHOTS, `pve04-${w}x${h}.jpg`), type: 'jpeg', quality: 82 });
      const imgBytes = served.filter(s => /\.(webp|jpg)$/.test(s.path)).reduce((a, s) => a + s.bytes, 0);
      await ctx.close();
      assert.equal(m.layout, layout);
      assert.ok(m.scrollW <= m.innerW, `horizontale scroll ${m.scrollW}>${m.innerW}`);
      assert.equal(m.tiles.length, 6);
      assert.deepEqual(m.overlaps, [], 'overlap ' + m.overlaps);
      assert.deepEqual(m.outside, [], 'buiten scène ' + m.outside);
      assert.deepEqual(m.small, [], 'te klein ' + m.small);
      assert.deepEqual(m.clipped, [], 'afgekapt ' + m.clipped);
      assert.match(m.src, /\.webp$/);
      assert.deepEqual(errors, []);
      if (w !== 768) assert.deepEqual(m.belowFold, [], 'onder de vouw ' + m.belowFold);
      metrics.viewports[`${w}x${h}`] = { layout: m.layout, image: m.src, imageBytes: imgBytes, belowFold: m.belowFold };
      return { layout: m.layout, image: m.src, imageKiB: Math.round(imgBytes / 1024), belowFold: m.belowFold };
    });
  }

  // ---------------------------------------------------------------- 200 % tekst
  for (const [w, h] of [[390, 844], [1440, 900], [320, 700]]) {
    await check(`200% tekst op ${w}x${h}: geen horizontale scroll, geen afgekapte waarde, geen overlap`, async () => {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=grote-waarden', dpr: WANT_SHOTS ? 2 : 1 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForTimeout(400);
      const m = await page.evaluate(MEASURE);
      if (WANT_SHOTS && w === 390) await page.screenshot({ path: path.join(SHOTS, `pve04-${w}x${h}-tekst200.jpg`), type: 'jpeg', quality: 82, fullPage: true });
      await ctx.close();
      assert.ok(m.scrollW <= m.innerW, `scroll ${m.scrollW}>${m.innerW}`);
      assert.deepEqual(m.clipped, [], 'afgekapt ' + m.clipped);
      assert.deepEqual(m.overlaps, [], 'overlap ' + m.overlaps);
      assert.deepEqual(m.outside, [], 'buiten scène ' + m.outside);
      assert.deepEqual(errors, []);
      return { stage: m.stage, values: m.tiles.map(t => t.value) };
    });
  }

  // ---------------------------------------------------------------- scenario's: DOM = model
  await check('alle scenario’s: DOM-routes en tegels volgen exact het model (incl. offline/stale/nacht/P1/negatief)', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    const out = await page.evaluate(() => {
      const c = window.__cockpits[0], ids = [...document.querySelectorAll('[data-scenario]')].map(b => b.dataset.scenario), res = {};
      for (const id of ids) {
        document.querySelector(`[data-scenario="${id}"]`).click();
        const m = c.model;
        const dom = Object.fromEntries([...document.querySelectorAll('.route')].map(g => [g.dataset.route, g.dataset.active === 'true']));
        const model = Object.fromEntries(Object.values(m.routes).map(r => [r.id, r.active]));
        const tiles = Object.fromEntries([...document.querySelectorAll('.tile')].map(b => [b.dataset.key, b.querySelector('.t-value').textContent]));
        res[id] = { dom, model, tilesOk: Object.keys(tiles).every(k => tiles[k] === m.tiles[k].value), warn: !document.querySelector('.ehc-warn').hidden, critical: m.warnings.length > 0, pressed: document.querySelector(`[data-scenario="${id}"]`).getAttribute('aria-pressed') };
      }
      return res;
    });
    await ctx.close();
    for (const [id, r] of Object.entries(out)) {
      assert.deepEqual(r.dom, r.model, id + ' routes ' + JSON.stringify(r));
      assert.ok(r.tilesOk, id + ' tegels');
      assert.equal(r.warn, r.critical, id + ' waarschuwing ' + JSON.stringify(r));
      assert.equal(r.pressed, 'true', id + ' knop');
    }
    assert.ok(Object.values(out.offline.dom).every(v => !v), 'offline zonder routes');
    assert.equal(out.verouderd.dom['home-grid'], false);
    assert.ok(Object.values(out['p1-fout'].dom).every(v => !v));
    assert.ok(Object.values(out['huis-negatief'].dom).every(v => !v));
    assert.equal(out['p1-omgekeerd'].dom['home-grid'], true);
    assert.deepEqual(errors, []);
    return { scenarios: Object.keys(out).length };
  });

  // ---------------------------------------------------------------- 50 updates
  await check('50 hertekeningen: geen DOM-rebuild, geen route-flikkering, deeltjes herstarten niet', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    await page.waitForTimeout(800);
    const out = await page.evaluate(async () => {
      const c = window.__cockpits[0];
      const tilesBefore = [...document.querySelectorAll('.tile')], routesBefore = [...document.querySelectorAll('.route')];
      let structural = 0, activeFlips = 0;
      const mo = new MutationObserver(list => { for (const m of list) { if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1)) structural++; if (m.type === 'attributes' && m.attributeName === 'data-active') activeFlips++; } });
      mo.observe(c.el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-active'] });
      const p0 = c.flows.phases('sun-home');
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 50; i++) { c.step(); await sleep(20); }
      await sleep(50); mo.disconnect();
      const p1 = c.flows.phases('sun-home');
      const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
      const initial = Array.from({ length: p0.length }, (_, i) => i / p0.length);
      return {
        structural, activeFlips,
        sameTiles: same([...document.querySelectorAll('.tile')], tilesBefore), sameRoutes: same([...document.querySelectorAll('.route')], routesBefore),
        moved: !same(p0, p1), resetToInitial: same(p1, initial), animating: c.flows.isAnimating(),
        pv: document.querySelector('.tile[data-key="pv"] .t-value').textContent
      };
    });
    await ctx.close();
    assert.equal(out.structural, 0, 'DOM-structuur gewijzigd');
    assert.equal(out.activeFlips, 0, 'route aan/uit geschakeld');
    assert.ok(out.sameTiles && out.sameRoutes, 'elementen vervangen');
    assert.ok(out.moved && !out.resetToInitial, 'deeltjes herstart of stil');
    assert.ok(out.animating);
    assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- reviewcorrecties: deeltjes, EV, minteken, overgangen
  await check('ongeldig/verouderd/offline: route direct uit en deeltjes staan onmiddellijk stil (alleen passieve fade)', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    await page.waitForTimeout(600);
    const out = await page.evaluate(async () => {
      const c = window.__cockpits[0], sleep = ms => new Promise(r => setTimeout(r, ms)), res = {};
      for (const [to, route] of [['offline', 'sun-home'], ['verouderd', 'home-grid'], ['onbekende-eenheid', 'sun-home'], ['ev-negatief', 'home-ev']]) {
        c.setScenario('zon-export'); await sleep(400);
        const moving0 = c.flows.phases(route); await sleep(120); const moving1 = c.flows.phases(route);
        c.setScenario(to);
        const domOff = document.querySelector(`.route[data-route="${route}"]`).dataset.active === 'false';
        const p0 = c.flows.phases(route); await sleep(250); const p1 = c.flows.phases(route);
        res[to] = { wasMoving: moving0.some((v, i) => v !== moving1[i]), domOff, frozen: p0.every((v, i) => v === p1[i]) };
      }
      return res;
    });
    await ctx.close();
    for (const [k, r] of Object.entries(out)) { assert.ok(r.wasMoving, k + ' bewoog eerst niet'); assert.ok(r.domOff, k + ' route nog actief'); assert.ok(r.frozen, k + ' deeltjes bewegen nog'); }
    assert.deepEqual(errors, []);
    return out;
  });

  await check('negatieve EV-meting, minteken bij teruglevering en scenario-overgangen in het DOM', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 390, height: 844, query: '?ticker=0&scenario=zon-export' });
    const out = await page.evaluate(() => {
      const c = window.__cockpits[0], q = s => document.querySelector(s);
      const net = q('.tile[data-key="net"] .t-value').textContent, netSub = q('.tile[data-key="net"] .t-sub').textContent;
      c.setScenario('ev-negatief');
      const ev = { value: q('.tile[data-key="cupra"] .t-value').textContent, sub: q('.tile[data-key="cupra"] .t-sub').textContent, route: q('.route[data-route="home-ev"]').dataset.active, tone: q('.tile[data-key="cupra"]').dataset.tone };
      c.setScenario('net-laden');
      const imp = q('.tile[data-key="net"] .t-value').textContent;
      const seq = ['zon-export', 'offline', 'nacht', 'p1-omgekeerd', 'p1-fout', 'zon-export'].map(id => { c.setScenario(id); return [id, [...document.querySelectorAll('.route[data-active="true"]')].map(g => g.dataset.route).sort().join(',')]; });
      return { net, netSub, ev, imp, seq };
    });
    await ctx.close();
    assert.equal(out.net, '−1,88 kW'); assert.match(out.netSub, /Teruglevering/);
    assert.equal(out.ev.value, '—'); assert.match(out.ev.sub, /negatief/); assert.equal(out.ev.route, 'false'); assert.equal(out.ev.tone, 'bad');
    assert.equal(out.imp, '7,60 kW');
    const seq = Object.fromEntries(out.seq);
    assert.equal(seq.offline, ''); assert.equal(seq['p1-fout'], '');
    assert.equal(seq.nacht, 'grid-home'); assert.equal(seq['p1-omgekeerd'], 'home-ev,home-grid,sun-home');
    assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- PVE-04: maskers, UI-laag, placeholder, terugval
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await check(`maskers ${w}x${h}: deeltjes verdwijnen achter voorgrondobjecten, routelijnen gemaskeerd, UI-kaarten erboven`, async () => {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=zon-export' });
      const out = await page.evaluate(async () => {
        const c = window.__cockpits[0], info = c.flows.maskInfo();
        const cv = document.querySelector('.ehc-flows canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);   // zelfde DPR als flows.js
        const mi = new Image(); mi.src = info.href; await mi.decode();
        const off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
        const g = off.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.drawImage(mi, info.rect.x, info.rect.y, info.rect.w, info.rect.h);
        const MA = g.getImageData(0, 0, off.width, off.height).data;
        let occluded = 0, free = 0;
        for (let f = 0; f < 24; f++) {
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const P = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          for (let i = 3; i < P.length; i += 4) if (P[i] > 8) { if (MA[i] >= 250) occluded++; else if (MA[i] === 0) free++; }
        }
        // test is alleen zinvol als de EV-route echt door een gemaskeerd object loopt
        const path = document.querySelector('.route[data-route="home-ev"] .r-core'), L = path.getTotalLength();
        let routeUnderMask = 0;
        for (let k = 0; k <= 60; k++) { const p = path.getPointAtLength(L * k / 60); const i = (Math.round(p.y * dpr) * off.width + Math.round(p.x * dpr)) * 4 + 3; if (MA[i] >= 250) routeUnderMask++; }
        const routesG = document.querySelector('.ehc-flows svg g.routes'), maskId = (routesG.getAttribute('mask') || '').replace(/^url\(#|\)$/g, '');
        const mimg = maskId && document.getElementById(maskId).querySelector('image');
        const tilesOnTop = [...document.querySelectorAll('.tile')].every(t => { const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.closest('.tile') === t; });
        const z = s => +getComputedStyle(document.querySelector(s)).zIndex;
        return { active: info.active, occluded, free, routeUnderMask, svgMask: !!mimg, svgHref: mimg && mimg.getAttribute('href'), svgRect: mimg && ['x', 'y', 'width', 'height'].map(a => +(+mimg.getAttribute(a)).toFixed(2)), rect: [info.rect.x, info.rect.y, info.rect.w, info.rect.h].map(v => +v.toFixed(2)), tilesOnTop, zFlows: z('.ehc-flows'), zTiles: z('.ehc-tiles'), maskState: document.querySelector('.ehc').dataset.mask };
      });
      await ctx.close();
      assert.equal(out.active, true); assert.equal(out.maskState, 'ok');
      assert.ok(out.routeUnderMask > 0, 'EV-route loopt niet door een masker; test niet zinvol');
      assert.equal(out.occluded, 0, `${out.occluded} deeltjespixels zichtbaar onder het masker`);
      assert.ok(out.free > 0, 'geen zichtbare deeltjes buiten het masker');
      assert.ok(out.svgMask, 'routelijnen niet gemaskeerd'); assert.match(out.svgHref, /mask-(desktop|mobile)-\d+\.png$/);
      assert.deepEqual(out.svgRect, out.rect);
      assert.ok(out.tilesOnTop, 'een UI-kaart wordt bedekt'); assert.ok(out.zTiles > out.zFlows, 'kaarten niet boven de routes');
      // de pixelmeting van deze test zelf leest de canvas herhaaldelijk uit; Chromium geeft daarover een prestatie-tip
      assert.deepEqual(errors.filter(e => !/willReadFrequently/.test(e)), []);
      return { occluded: out.occluded, free: out.free, routeUnderMask: out.routeUnderMask };
    });
  }

  await check('placeholder-status zichtbaar: "Tijdelijk beeld — niet visueel goedgekeurd"; batterij linksonder (desktop)', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    const out = await page.evaluate(() => {
      const n = document.querySelector('.ehc-scene-note'), st = document.querySelector('.ehc-stage').getBoundingClientRect(), b = document.querySelector('.tile[data-key="battery"]').getBoundingClientRect();
      return { note: n && !n.hidden ? n.textContent : null, scene: document.querySelector('.ehc').dataset.scene, batteryLeft: b.left - st.left < st.width * 0.25, batteryBottom: b.bottom > st.top + st.height * 0.7, status: window.__cockpits[0].manifest.status };
    });
    await ctx.close();
    assert.equal(out.status, 'placeholder'); assert.equal(out.note, 'Tijdelijk beeld — niet visueel goedgekeurd'); assert.equal(out.scene, 'ok');
    assert.ok(out.batteryLeft && out.batteryBottom, 'batterij niet linksonder');
    assert.deepEqual(errors, []);
    return out;
  });

  await check('terugval: geen manifest, kapotte beeldlaag of kapot masker ⇒ interface blijft werken, geen JS-fouten', async () => {
    const res = {};
    for (const [name, opt] of [
      ['geen-manifest', { query: '?ticker=0&manifest=0', waitImage: false }],
      ['beeldlaag-404', { query: '?ticker=0', waitImage: false, route: { pattern: /placeholder-desktop-.*\.(webp|jpg)$/ } }],
      ['masker-404', { query: '?ticker=0', waitImage: false, route: { pattern: /mask-desktop-.*\.png$/ } }]
    ]) {
      const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, ...opt });
      await page.waitForTimeout(700);
      res[name] = await page.evaluate(() => {
        const r = document.querySelector('.ehc'), n = document.querySelector('.ehc-scene-note');
        return { scene: r.dataset.scene, mask: r.dataset.mask || 'none', note: n.hidden ? null : n.textContent, pv: document.querySelector('.tile[data-key="pv"] .t-value').textContent, net: document.querySelector('.tile[data-key="net"] .t-value').textContent, flowsHidden: document.querySelector('.ehc-flows').hidden, maskActive: window.__cockpits[0].flows.maskInfo().active, jsErrors: window.__errors };
      });
      res[name].consoleErrors = errors.filter(e => !/Failed to load resource|404/.test(e));
      await ctx.close();
    }
    for (const [k, r] of Object.entries(res)) { assert.equal(r.pv, '4,82 kW', k); assert.equal(r.net, '−1,88 kW', k); assert.deepEqual(r.jsErrors, [], k); assert.deepEqual(r.consoleErrors, [], k); }
    assert.equal(res['geen-manifest'].scene, 'missing'); assert.match(res['geen-manifest'].note, /ontbreekt/); assert.equal(res['geen-manifest'].flowsHidden, true);
    assert.equal(res['beeldlaag-404'].scene, 'error'); assert.match(res['beeldlaag-404'].note, /kon niet laden/); assert.equal(res['beeldlaag-404'].flowsHidden, true);
    assert.equal(res['masker-404'].scene, 'ok'); assert.equal(res['masker-404'].mask, 'error'); assert.equal(res['masker-404'].maskActive, false);
    return Object.fromEntries(Object.entries(res).map(([k, r]) => [k, { scene: r.scene, mask: r.mask, note: r.note }]));
  });

  // ---------------------------------------------------------------- toetsenbord
  await check('toetsenbord: Tab → tegel, Enter opent detail, focus op Sluiten, Escape sluit en herstelt focus; klik buiten sluit', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    let key = null;
    for (let i = 0; i < 10 && !key; i++) { await page.keyboard.press('Tab'); key = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('tile') ? document.activeElement.dataset.key : null); }
    assert.ok(key, 'geen tegel bereikt met Tab');
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => ({ hidden: document.querySelector('.ehc-detail').hidden, focus: document.activeElement.className, expanded: document.querySelector('.tile[aria-expanded="true"]')?.dataset.key, title: document.querySelector('.d-title').textContent }));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({ hidden: document.querySelector('.ehc-detail').hidden, focus: document.activeElement.dataset.key }));
    await page.click('.tile[data-key="battery"]');
    const batt = await page.evaluate(() => document.querySelector('.d-list').textContent);
    await page.mouse.click(5, 5);
    const outside = await page.evaluate(() => document.querySelector('.ehc-detail').hidden);
    await ctx.close();
    assert.equal(ring, 'solid', 'focusring zichtbaar');
    assert.equal(opened.hidden, false); assert.equal(opened.focus, 'd-close'); assert.equal(opened.expanded, key);
    assert.equal(closed.hidden, true); assert.equal(closed.focus, key);
    assert.match(batt, /geen fysieke opslag/);
    assert.equal(outside, true);
    assert.deepEqual(errors, []);
    return { firstTile: key, title: opened.title };
  });

  // ---------------------------------------------------------------- reduced motion
  await check('prefers-reduced-motion: geen deeltjesanimatie, richting blijft zichtbaar via pijlen', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0', reducedMotion: 'reduce' });
    await page.waitForTimeout(500);
    const out = await page.evaluate(() => ({
      animating: window.__cockpits[0].flows.isAnimating(), rafs: window.__live.rafs.size,
      chev: [...document.querySelectorAll('.route[data-active="true"] .r-chev path')].map(p => +getComputedStyle(p).opacity)
    }));
    await ctx.close();
    assert.equal(out.animating, false);
    assert.equal(out.rafs, 0, 'rAF loopt nog');
    assert.ok(out.chev.length >= 6 && out.chev.every(o => o > 0.5), 'richtingspijlen');
    assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- verborgen tab
  await check('verborgen tab pauzeert animatie en schommeling; zichtbaar hervat', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900 });
    const out = await page.evaluate(async () => {
      const c = window.__cockpits[0], sleep = ms => new Promise(r => setTimeout(r, ms));
      const before = { anim: c.flows.isAnimating(), intervals: window.__live.intervals.size };
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      await sleep(150);
      const hidden = { anim: c.flows.isAnimating(), intervals: window.__live.intervals.size, rafs: window.__live.rafs.size };
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      await sleep(150);
      return { before, hidden, after: { anim: c.flows.isAnimating(), intervals: window.__live.intervals.size } };
    });
    await ctx.close();
    assert.ok(out.before.anim && out.before.intervals === 1);
    assert.deepEqual(out.hidden, { anim: false, intervals: 0, rafs: 0 });
    assert.ok(out.after.anim && out.after.intervals === 1);
    assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- twee instanties + opruimen
  await check('twee gelijktijdige instanties: onafhankelijk; destroy() ruimt timers, rAF en listeners op', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 1800, query: '?instances=2' });
    const out = await page.evaluate(async () => {
      const [a, b] = window.__cockpits, sleep = ms => new Promise(r => setTimeout(r, ms));
      const ids = [...document.querySelectorAll('.ehc-detail')].map(d => d.id);
      b.setScenario('nacht');
      const indep = a.scenario === 'zon-export' && b.scenario === 'nacht';
      const live1 = { intervals: window.__live.intervals.size };
      a.destroy(); await sleep(200);
      const mid = { count: document.querySelectorAll('.ehc').length, intervals: window.__live.intervals.size, bStill: b.flows.isAnimating() };
      // Escape op document mag na destroy geen fout geven
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      b.destroy(); await sleep(300);
      return { ids, indep, live1, mid, end: { count: document.querySelectorAll('.ehc').length, intervals: window.__live.intervals.size, rafs: window.__live.rafs.size }, errors: window.__errors };
    });
    await ctx.close();
    assert.equal(new Set(out.ids).size, 2, 'unieke ids');
    assert.ok(out.indep);
    assert.equal(out.live1.intervals, 2);
    assert.deepEqual(out.mid, { count: 1, intervals: 1, bStill: true });
    assert.deepEqual(out.end, { count: 0, intervals: 0, rafs: 0 });
    assert.deepEqual(out.errors, []); assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- performance
  await check('performance: fps onder 4× CPU-throttling, geheugen na 200 updates, beeldgewicht', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?scenario=praktijk-sim' });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const heap = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize').value;
    await cdp.send('HeapProfiler.collectGarbage');
    const h0 = await heap();
    await page.evaluate(async () => { const c = window.__cockpits[0]; for (let i = 0; i < 200; i++) c.step(); });
    await cdp.send('HeapProfiler.collectGarbage');
    const h1 = await heap();
    const fps = async () => page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
    const fps1 = await fps();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const fps4 = await fps();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ctx.close();
    assert.deepEqual(errors, []);
    const out = { fps1x: +fps1.toFixed(1), fps4x: +fps4.toFixed(1), heapMB: +(h1 / 1048576).toFixed(2), heapDeltaKB: Math.round((h1 - h0) / 1024) };
    assert.ok(out.heapDeltaKB < 2048, 'geheugengroei');
    metrics.performance = out;
    return out;
  });

  await browser.close();
  srv.close();
  metrics.results = results.map(r => ({ name: r.name, ok: r.ok }));
  if (WANT_SHOTS) fs.writeFileSync(path.join(SHOTS, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
  console.log(`\n${results.length - failed}/${results.length} browsercontroles geslaagd`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
