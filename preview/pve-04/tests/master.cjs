'use strict';
/*
 * PVE-04 · browseracceptatie van de MASTER-cockpit (standaard): goedgekeurde afbeelding als vaste achtergrond.
 *   node preview/pve-04/tests/master.cjs                      # Chromium
 *   node preview/pve-04/tests/master.cjs --browser=webkit     # WebKit (CDP-metingen overgeslagen)
 *   node preview/pve-04/tests/master.cjs --screenshots        # + screenshots desktop/mobiel × actief/0 W/offline
 * Exit-code 0 = alle controles geslaagd.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const PW = require(require.resolve('playwright', { paths: [process.cwd(), __dirname] }));
const SCENE = require('../master-scene.js');
const M = require('../model.js');
const ENGINE = (process.argv.find(a => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
const IS_CHROMIUM = ENGINE === 'chromium';
const WANT_SHOTS = process.argv.includes('--screenshots');
const ROOT = path.join(__dirname, '..', '..');               // preview/ (de master staat in pve-03/reference)
const SHOTS = path.join(__dirname, '..', 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * 4), stride = w * bpp; let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], line = Buffer.from(raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      line[i] = (line[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? ((pa, pb, pc) => pa <= pb && pa <= pc ? a : pb <= pc ? b : c)(Math.abs(b - c), Math.abs(a - c), Math.abs(a + b - 2 * c)) : 0)) & 255; }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = line[x * bpp]; out[(y * w + x) * 4 + 1] = line[x * bpp + 1]; out[(y * w + x) * 4 + 2] = line[x * bpp + 2]; out[(y * w + x) * 4 + 3] = 255; }
    prev = line; }
  return { w, h, data: out };
}

let served = [];
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(ROOT, u);
      if (!path.resolve(file).startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      const buf = fs.readFileSync(file); served.push({ path: u, bytes: buf.length });
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const results = []; let failed = 0;
async function check(name, fn) {
  try { const info = await fn(); results.push({ name, ok: true, info }); console.log('PASS', name, info ? JSON.stringify(info) : ''); }
  catch (e) { failed++; results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '-', process.env.EH_VERBOSE ? e.stack : e.message.split('\n')[0]); }
}
const INSTRUMENT = () => {
  const live = { intervals: new Set(), rafs: new Set() };
  const si = window.setInterval, ci = window.clearInterval, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setInterval = function (...a) { const id = si.apply(this, a); live.intervals.add(id); return id; };
  window.clearInterval = function (id) { live.intervals.delete(id); return ci.call(this, id); };
  window.requestAnimationFrame = function (cb) { let id; id = ra.call(this, t => { live.rafs.delete(id); cb(t); }); live.rafs.add(id); return id; };
  window.cancelAnimationFrame = function (id) { live.rafs.delete(id); return ca.call(this, id); };
  window.__live = live;
};
async function open(browser, base, { width, height, query = '', reducedMotion = 'no-preference', dpr = 1, wait = true, url = null }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INSTRUMENT);
  await page.goto(url || base + '/pve-04/index.html' + query);
  await page.waitForFunction('window.__mounted === true');
  if (wait) await page.waitForFunction(() => { const e = document.querySelector('.ehc'); return e && e.dataset.quiet !== 'pending'; }, null, { timeout: 15000 });
  await page.waitForTimeout(450);
  return { ctx, page, errors };
}

// Maatvoering + dekking in de pagina: elk afdekvlak (kaart of plaatje) moet het ingebakken kaartkader + 5 px (natuurlijk) bevatten.
const MEASURE = () => {
  const S = window.EhPve04MasterScene, root = document.querySelector('.ehc'), stage = root.querySelector('.ehm-stage');
  const sr = stage.getBoundingClientRect(), k = sr.width / S.image.natural.w;
  const layout = root.dataset.layout;
  const cover = [];
  for (const [key, c] of Object.entries(S.covers)) {
    const node = key === 'pill' ? root.querySelector('.ehm-pill') : layout === 'overlay' ? root.querySelector(`.ehm-tiles .tile[data-key="${key}"]`) : root.querySelector(`.ehm-plate[data-key="${key}"]`);
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    const b = c.baked, m = 5 * k;
    const need = { l: sr.left + b.x * sr.width - m, t: sr.top + b.y * sr.height - m, r: sr.left + (b.x + b.w) * sr.width + m, b: sr.top + (b.y + b.h) * sr.height + m };
    const slack = Math.min(r.left - need.l, r.top - need.t, need.r - r.right, need.b - r.bottom) * -1;   // ≥ 0 = bevat
    const bg = cs.backgroundImage;
    const opaque = cs.opacity === '1' && cs.visibility === 'visible' && cs.display !== 'none' && /gradient/.test(bg) && !/rgba\([^)]*,\s*0?\.\d+\)/.test(bg);
    cover.push({ key, contains: slack >= -0.5, slack: +slack.toFixed(2), opaque });
  }
  const tiles = [...root.querySelectorAll('.ehm-tiles .tile')].map(b => {
    const r = b.getBoundingClientRect(), v = b.querySelector('.t-value'), t = b.querySelector('.t-title');
    return { key: b.dataset.key, w: r.width, h: r.height, valueClipped: v.scrollWidth > v.clientWidth + 1, titleClipped: t.scrollWidth > t.clientWidth + 1, value: v.textContent };
  });
  return { layout, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, stage: { w: +sr.width.toFixed(1), h: +sr.height.toFixed(1) }, u: +k.toFixed(3), cover, tiles,
    small: tiles.filter(t => t.w < 48 || t.h < 48).map(t => t.key), clipped: tiles.filter(t => t.valueClipped).map(t => t.key), titleClipped: tiles.filter(t => t.titleClipped).map(t => t.key) };
};

function hueOf(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  return d ? (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6 : 0;
}
// "Stroomzichtbaarheid": aandeel monsters op de kernlijn dat helder en verzadigd in de lijnkleur is (praktijk: helder wit).
function flowness(png, stageBox, flow) {
  const pts = flow.points.map(p => [p[0] * stageBox.w, p[1] * stageBox.h]);
  let n = 0, hit = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.round(L / 2));
    for (let s = 0; s < steps; s++) {
      const x = Math.round(ax + (bx - ax) * s / steps), y = Math.round(ay + (by - ay) * s / steps);
      if (x < 0 || y < 0 || x >= png.w || y >= png.h) continue;
      // binnen ±3 px de felste pixel nemen (lijnkern 2–4 px; de overlay-coördinaten volgen de lijn tot op enkele px)
      let best = null;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= png.w || yy >= png.h) continue;
        const o = (yy * png.w + xx) * 4, r = png.data[o], g = png.data[o + 1], b = png.data[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
        let hue = 0; const dd = mx - mn;
        if (dd) hue = (mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4) / 6;
        if (!best || v > best.v) best = { v, sat, hue };
      }
      if (!best) continue;
      n++;
      // lijnkleur: tint binnen ±0,05 van de lijnkleur (master-scene.js), helder en verzadigd; praktijk: helder wit
      const fh = hueOf(flow.color), dh = Math.min(Math.abs(best.hue - fh), 1 - Math.abs(best.hue - fh));
      const isFlow = flow.group === 'practice' ? best.v > 0.9 && best.sat < 0.22 : best.v > 0.78 && best.sat > 0.22 && dh < 0.05;
      if (isFlow) hit++;
    }
  }
  return n ? hit / n : 0;
}

(async () => {
  if (WANT_SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await PW[ENGINE].launch();
  console.log(ENGINE, browser.version());
  const metrics = { engine: ENGINE, version: browser.version(), viewports: {}, flowness: {} };
  const chromiumOnly = async (name, fn) => IS_CHROMIUM ? check(name, fn) : (results.push({ name, ok: true, info: 'overgeslagen (alleen Chromium/CDP)' }), console.log('SKIP', name, '(alleen Chromium/CDP)'));

  // ---------------------------------------------------------------- viewports + kaartdekking
  const VIEWPORTS = [[320, 700, 'compact'], [390, 844, 'compact'], [768, 1024, 'compact'], [1024, 768, 'overlay'], [1330, 748, 'overlay'], [1440, 900, 'overlay'], [1920, 1080, 'overlay']];
  for (const [w, h, layout] of VIEWPORTS) {
    await check(`viewport ${w}x${h}: ${layout}, kaartdekking ≥ ingebakken kaart + 5 px, ondoorzichtig, geen overflow/afkapping, targets ≥48px, geen fouten`, async () => {
      served = [];
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=grote-waarden' });
      const m = await page.evaluate(MEASURE);
      metrics.viewports[`${w}x${h}`] = m;
      await ctx.close();
      assert.equal(m.layout, layout);
      assert.ok(m.scrollW <= m.innerW, 'horizontale scroll');
      const bad = m.cover.filter(c => !c.contains || !c.opaque);
      assert.deepEqual(bad, [], 'dekking');
      assert.deepEqual(m.small, [], 'te kleine targets');
      assert.deepEqual(m.clipped, [], 'afgekapte waarde');
      if (layout === 'compact') assert.deepEqual(m.titleClipped, [], 'afgekapte titel');
      assert.deepEqual(errors, []);
      const img = served.filter(s => /\.webp$/.test(s.path));
      assert.equal(img.length, 1); assert.ok(img[0].path.endsWith('approved-visual-20261109.webp'));
      return { layout: m.layout, u: m.u, minSlackPx: Math.min(...m.cover.map(c => c.slack)), titleClipped: m.titleClipped, imgKB: Math.round(img[0].bytes / 1024) };
    });
  }

  // ---------------------------------------------------------------- 200 % tekst (mobiel en desktop)
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    await check(`200% tekst ${w}x${h}: geen horizontale scroll, dekking blijft intact`, async () => {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0' });
      await page.addStyleTag({ content: 'html{font-size:200%}' }); await page.waitForTimeout(300);
      const m = await page.evaluate(MEASURE);
      await ctx.close();
      assert.ok(m.scrollW <= m.innerW);
      assert.deepEqual(m.cover.filter(c => !c.contains), []);
      if (m.layout === 'compact') assert.deepEqual(m.clipped, []);
      assert.deepEqual(errors, []);
      return { layout: m.layout, clippedOverlay: m.layout === 'overlay' ? m.clipped : [] };
    });
  }

  // ---------------------------------------------------------------- stroomlijnen: rustlagen volgen exact het model
  await check('alle scenario’s: rustlaag per lijn aan ⇔ geen actieve route (DOM = model), deeltjes alleen bij actief', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    const rows = await page.evaluate(ids => ids.map(id => {
      const c = window.__cockpits[0]; c.setScenario(id);
      const m = c.model, q = c.quietInfo();
      const want = { pv: !m.routes['sun-home'].active, practice: !m.routes['home-practice'].active, net: !(m.routes['home-grid'].active || m.routes['grid-home'].active), ev: !m.routes['home-ev'].active };
      return { id, state: q.state, q: q.groups, want, ok: JSON.stringify(q.groups) === JSON.stringify(want) };
    }), M.SCENARIO_IDS);
    await ctx.close();
    assert.deepEqual(rows.filter(r => !r.ok || r.state !== 'ok'), []);
    assert.deepEqual(errors, []);
    const pick = id => rows.find(r => r.id === id).q;
    assert.deepEqual(pick('nul-watt'), { pv: true, practice: true, net: true, ev: true });
    assert.deepEqual(pick('offline'), { pv: true, practice: true, net: true, ev: true });
    assert.equal(pick('verouderd').net, true, 'verouderde P1: netlijn onderdrukt');
    assert.equal(pick('praktijk-sim').practice, false, 'praktijk alleen bij expliciete simulatie actief');
    return { scenarios: rows.length };
  });

  // ---------------------------------------------------------------- pixeltoets: zijn ingebakken lijnen echt onzichtbaar bij 0 W/offline?
  await check('pixeltoets: ingebakken stroomlijnen bij 0 W, offline en verouderd onzichtbaar (≤ 3 % én ≤ 15 % van actief)', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    const shot = async sc => {
      await page.evaluate(id => window.__cockpits[0].setScenario(id), sc);
      await page.evaluate(() => window.__cockpits[0].setPaused(true));   // deeltjes niet meetellen
      await page.waitForTimeout(900);                                     // fade (0,6 s) volledig af
      const box = await page.locator('.ehm-stage').boundingBox();
      return { png: decodePng(await page.locator('.ehm-stage').screenshot()), box };
    };
    const out = {};
    const states = { 'zon-export': null, 'praktijk-sim': null, 'net-laden': null, 'nul-watt': null, offline: null, verouderd: null };
    for (const s of Object.keys(states)) states[s] = await shot(s);
    for (const f of SCENE.flows) {
      const row = {};
      for (const [s, v] of Object.entries(states)) row[s] = +flowness(v.png, { w: v.png.w, h: v.png.h }, f).toFixed(3);
      out[f.id] = row;
    }
    await ctx.close();
    metrics.flowness = out;
    const active = { 'flow-pv': 'zon-export', 'flow-practice': 'praktijk-sim', 'flow-net': 'zon-export', 'flow-car': 'zon-export', 'flow-card-car': 'zon-export' };
    const problems = [];
    for (const [fid, row] of Object.entries(out)) {
      const ref = row[active[fid]];
      for (const q of ['nul-watt', 'offline']) if (row[q] > 0.03 || row[q] > ref * 0.15) problems.push(`${fid}@${q}=${row[q]} (actief ${ref})`);
      if (ref < 0.1) problems.push(`${fid}: actieve lijn niet herkend door de meting (${ref}) — toets ongeldig`);
    }
    if (out['flow-net'].verouderd > 0.03) problems.push('flow-net@verouderd=' + out['flow-net'].verouderd);
    assert.deepEqual(problems, []);
    assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- deeltjes
  await check('deeltjes: bewegen alleen op actieve lijnen, in stroomrichting; bij offline direct stil', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    const ph = () => page.evaluate(() => Object.fromEntries(['flow-pv', 'flow-practice', 'flow-net', 'flow-car'].map(f => [f, window.__cockpits[0].phases(f)])));
    const a = await ph(); await page.waitForTimeout(500); const b = await ph();
    const moved = f => a[f].some((v, i) => Math.abs(v - b[f][i]) > 1e-4);
    const r1 = { pv: moved('flow-pv'), net: moved('flow-net'), car: moved('flow-car'), practice: moved('flow-practice') };
    await page.evaluate(() => window.__cockpits[0].setScenario('offline'));
    const c = await ph(); await page.waitForTimeout(400); const d = await ph();
    const frozen = ['flow-pv', 'flow-net', 'flow-car'].every(f => c[f].every((v, i) => v === d[f][i]));
    await page.waitForTimeout(400);
    const idle = await page.evaluate(() => !window.__cockpits[0].isAnimating());
    await ctx.close();
    assert.deepEqual(r1, { pv: true, net: true, car: true, practice: false });
    assert.ok(frozen, 'deeltjes staan niet stil'); assert.ok(idle, 'animatielus loopt door zonder actieve route');
    assert.deepEqual(errors, []);
    return { r1, frozen, idle };
  });

  // ---------------------------------------------------------------- inhoud: DEMO, simulatie, praktijk, minteken
  await check('inhoud: DEMO zichtbaar, batterij = Simulatie, praktijk "Nog niet gekoppeld", minteken U+2212, ingebakken waarden afgedekt', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    const info = await page.evaluate(() => {
      const r = document.querySelector('.ehc'), t = k => r.querySelector(`.ehm-tiles .tile[data-key="${k}"]`);
      return { badge: r.querySelector('.ehc-demo').textContent, pill: r.querySelector('.ehm-pill').textContent, battery: t('battery').textContent, practice: t('practice').textContent, net: t('net').querySelector('.t-value').textContent, house: t('house').querySelector('.t-value').textContent };
    });
    await ctx.close();
    assert.match(info.badge, /DEMO — fictieve meetwaarden/);
    assert.match(info.pill, /DEMO/);
    assert.match(info.battery, /Simulatie/); assert.match(info.battery, /Geen fysieke opslag/);
    assert.match(info.practice, /Nog niet gekoppeld/);
    assert.equal(info.net.charAt(0), '−');
    assert.notEqual(info.house, '2,14 kW', 'ingebakken voorbeeldwaarde');
    assert.deepEqual(errors, []);
    return info;
  });

  // ---------------------------------------------------------------- 50 updates
  await check('50 hertekeningen: geen DOM-rebuild, rustlagen flikkeren niet, deeltjesfase loopt door', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    const r = await page.evaluate(async () => {
      const c = window.__cockpits[0]; let structural = 0, flips = 0;
      const mo = new MutationObserver(list => { for (const m of list) { if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1)) structural++; if (m.type === 'attributes') flips++; } });
      mo.observe(c.el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-suppressed'] });
      for (let i = 0; i < 50; i++) { c.step(); await new Promise(res => setTimeout(res, 15)); }
      mo.disconnect(); return { structural, flips };
    });
    await ctx.close();
    assert.deepEqual(r, { structural: 0, flips: 0 });
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- terugval
  await check('terugval: geen scènedata / beeld laadt niet ⇒ alleen interface (compact), geen JS-fouten', async () => {
    const out = {};
    for (const [name, q] of [['geen-scene', '?ticker=0&masterScene=0'], ['beeld-404', '?ticker=0&masterBase=missing']]) {
      const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: q, wait: false });
      await page.waitForTimeout(800);
      out[name] = await page.evaluate(() => { const r = document.querySelector('.ehc'); return { scene: r.dataset.scene, layout: r.dataset.layout, note: r.querySelector('.ehc-scene-note').textContent, stageVisible: getComputedStyle(r.querySelector('.ehm-stage')).display !== 'none', tiles: r.querySelectorAll('.ehm-tiles .tile').length, value: r.querySelector('.tile[data-key="house"] .t-value').textContent }; });
      out[name].errors = errors.filter(e => !/Failed to load resource|404/.test(e));
      await ctx.close();
    }
    assert.equal(out['geen-scene'].scene, 'missing'); assert.equal(out['beeld-404'].scene, 'error');
    for (const v of Object.values(out)) { assert.equal(v.layout, 'compact'); assert.equal(v.stageVisible, false); assert.equal(v.tiles, 6); assert.notEqual(v.value, '—'); assert.deepEqual(v.errors, []); }
    return out;
  });

  await check('file:// (canvas mogelijk geblokkeerd): rustlaag óf zichtbare dimterugval met melding', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, url: 'file://' + path.join(ROOT, 'pve-04', 'index.html') + '?ticker=0&scenario=nul-watt' });
    const r = await page.evaluate(() => { const e = document.querySelector('.ehc'); return { quiet: e.dataset.quiet, dim: getComputedStyle(e.querySelector('.ehm-dim')).display, note: e.querySelector('.ehc-scene-note').textContent, dimOn: [...e.querySelectorAll('.ehm-dim g')].map(g => g.dataset.suppressed) }; });
    await ctx.close();
    assert.ok(['ok', 'unavailable'].includes(r.quiet), r.quiet);
    if (r.quiet === 'unavailable') { assert.equal(r.dim, 'block'); assert.match(r.note, /niet onderdrukbaar/); assert.ok(r.dimOn.every(v => v === 'true')); }
    assert.deepEqual(errors.filter(e => !/getImageData|tainted|insecure|SecurityError|willReadFrequently/i.test(e)), []);
    return r;
  });

  // ---------------------------------------------------------------- toetsenbord, reduced motion, verborgen tab, instanties
  await check('toetsenbord: Tab → kaart, Enter opent detail, Escape sluit en herstelt focus', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    let key = null;
    for (let i = 0; i < 12 && !key; i++) { await page.keyboard.press('Tab'); key = await page.evaluate(() => document.activeElement.closest('.tile') ? document.activeElement.dataset.key : null); }
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => ({ open: !document.querySelector('.ehc-detail').hidden, focus: document.activeElement.className }));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({ hidden: document.querySelector('.ehc-detail').hidden, focusKey: document.activeElement.dataset.key }));
    await ctx.close();
    assert.ok(key); assert.equal(opened.open, true); assert.equal(opened.focus, 'd-close'); assert.equal(closed.hidden, true); assert.equal(closed.focusKey, key);
    assert.deepEqual(errors, []);
    return { key };
  });
  await check('prefers-reduced-motion: geen animatielus, richting via pijlen op actieve lijnen', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export', reducedMotion: 'reduce' });
    const r = await page.evaluate(async () => { const c = window.__cockpits[0]; const a = c.phases('flow-pv'); await new Promise(res => setTimeout(res, 400)); return { animating: c.isAnimating(), same: JSON.stringify(a) === JSON.stringify(c.phases('flow-pv')), rafs: window.__live.rafs.size }; });
    await ctx.close();
    assert.equal(r.animating, false); assert.equal(r.same, true);
    assert.deepEqual(errors, []);
    return r;
  });
  await check('twee instanties onafhankelijk; destroy() ruimt timers, rAF en DOM op', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 1800, query: '?instances=2' });
    const out = await page.evaluate(async () => {
      const [a, b] = window.__cockpits; const start = { a: a.scenario, b: b.scenario };
      a.setScenario('offline'); const indep = b.quietInfo().groups.ev === false && a.quietInfo().groups.ev === true;
      a.destroy(); b.destroy(); await new Promise(res => setTimeout(res, 300));
      return { start, indep, count: document.querySelectorAll('.ehc').length, intervals: window.__live.intervals.size, rafs: window.__live.rafs.size };
    });
    await ctx.close();
    assert.deepEqual(out.start, { a: 'zon-export', b: 'net-laden' });
    assert.equal(out.indep, true);
    assert.deepEqual([out.count, out.intervals, out.rafs], [0, 0, 0]);
    assert.deepEqual(errors, []);
    return out;
  });

  // ---------------------------------------------------------------- performance
  await chromiumOnly('performance: fps (1× en 4× CPU) met actieve deeltjes, rustlaag-rekentijd, geheugen na 200 updates', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=praktijk-sim' });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const heap = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize').value;
    await cdp.send('HeapProfiler.collectGarbage'); const h0 = await heap();
    await page.evaluate(() => { const c = window.__cockpits[0]; for (let i = 0; i < 200; i++) c.step(); });
    await cdp.send('HeapProfiler.collectGarbage'); const h1 = await heap();
    const measure = () => page.evaluate(() => new Promise(res => { const t = []; let last = performance.now(); const t0 = last; const f = now => { t.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else res(t.slice(1)); }; requestAnimationFrame(f); }));
    const stat = d => { const s = [...d].sort((a, b) => a - b); return { fps: +(1000 / (d.reduce((a, b) => a + b, 0) / d.length)).toFixed(1), p95: +s[Math.floor(0.95 * s.length)].toFixed(1) }; };
    const s1 = stat(await measure());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); const s4 = stat(await measure());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const quietMs = await page.evaluate(() => +document.querySelector('.ehc').dataset.quietMs);
    await ctx.close();
    assert.deepEqual(errors, []);
    const out = { fps1x: s1.fps, p95_1x: s1.p95, fps4x: s4.fps, p95_4x: s4.p95, quietBuildMs: quietMs, heapDeltaKB: Math.round((h1 - h0) / 1024),
      verdict4x: s4.fps < 30 ? 'FOUT (< 30 fps)' : s4.fps < 45 ? 'DOEL NIET GEHAALD' : s4.fps < 50 ? 'WAARSCHUWING (45–49)' : 'DOEL (≥ 50 fps)' };
    assert.ok(s4.fps >= 30, 'harde ondergrens 30 fps bij 4×');
    assert.ok(out.heapDeltaKB < 2048, 'geheugengroei');
    metrics.performance = out;
    return out;
  });

  // ---------------------------------------------------------------- screenshots
  if (WANT_SHOTS) {
    await check('screenshots: desktop en mobiel × actief / 0 W / offline', async () => {
      const files = [];
      for (const [vp, w, h] of [['desktop', 1440, 900], ['mobiel', 390, 844]]) for (const [state, sc] of [['actief', 'zon-export'], ['0w', 'nul-watt'], ['offline', 'offline']]) {
        const { ctx, page } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=' + sc, dpr: vp === 'mobiel' ? 2 : 1 });
        await page.waitForTimeout(700);
        const f = `master-${vp}-${state}${IS_CHROMIUM ? '' : '-' + ENGINE}.jpg`;
        await page.screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 82, fullPage: vp === 'mobiel' });
        files.push(f); await ctx.close();
      }
      return files;
    });
  }

  await browser.close(); srv.close();
  metrics.results = results.map(r => ({ name: r.name, ok: r.ok }));
  if (WANT_SHOTS) fs.writeFileSync(path.join(SHOTS, IS_CHROMIUM ? 'master-metrics.json' : `master-metrics-${ENGINE}.json`), JSON.stringify(metrics, null, 2) + '\n');
  console.log(`\n${results.length - failed}/${results.length} master-controles geslaagd (${ENGINE} ${metrics.version})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
