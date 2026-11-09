'use strict';
/*
 * PVE-04 · browseracceptatie van de MASTER-cockpit (standaard): goedgekeurde afbeelding als vaste achtergrond.
 *   node preview/pve-04/tests/master.cjs                      # Chromium
 *   node preview/pve-04/tests/master.cjs --browser=webkit     # WebKit (CDP-metingen overgeslagen)
 *   node preview/pve-04/tests/master.cjs --screenshots        # + screenshots desktop/mobiel × actief/0 W/offline/afname
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
  if (wait) await page.waitForFunction(() => { const e = document.querySelector('.ehc'); return e && e.dataset.scene !== 'loading' && e.dataset.tint !== 'none'; }, null, { timeout: 15000 });
  await page.waitForTimeout(450);
  return { ctx, page, errors };
}

// Maatvoering in de pagina: dekking (afdekvlak ⊇ ingebakken kaart + 5 px), ondoorzichtig basisvlak, tikvlakken,
// afkapping, dubbele gegevens en de eerste schermhoogte.
const MEASURE = () => {
  const S = window.EhPve04MasterScene, root = document.querySelector('.ehc'), stage = root.querySelector('.ehm-stage');
  const sr = stage.getBoundingClientRect(), k = sr.width / S.image.natural.w, layout = root.dataset.layout;
  const vis = n => { const cs = getComputedStyle(n); return cs.display !== 'none' && cs.visibility === 'visible' && n.getBoundingClientRect().width > 0; };
  const cover = [];
  for (const [key, c] of Object.entries(S.covers)) {
    const node = key === 'pill' ? root.querySelector('.ehm-pill') : layout === 'list' ? root.querySelector(`.ehm-plate[data-key="${key}"]`) : root.querySelector(`.ehm-tiles .tile[data-key="${key}"]`);
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node), b = c.baked, m = 5 * k;
    const need = { l: sr.left + b.x * sr.width - m, t: sr.top + b.y * sr.height - m, r: sr.left + (b.x + b.w) * sr.width + m, b: sr.top + (b.y + b.h) * sr.height + m };
    const slack = Math.min(r.left - need.l, r.top - need.t, need.r - r.right, need.b - r.bottom) * -1;
    const layers = cs.backgroundImage.split(/,\s*(?=linear-gradient)/), baseLayer = layers[layers.length - 1];
    const opaque = vis(node) && cs.opacity === '1' && layers.length >= 2 && !/rgba\([^)]*,\s*0?\.\d+\)|transparent/.test(baseLayer);
    cover.push({ key, contains: slack >= -0.5, slack: +slack.toFixed(2), opaque });
  }
  const tiles = [...root.querySelectorAll('.ehm-tiles .tile')].map(b => {
    const r = b.getBoundingClientRect(), body = b.querySelector('.t-body'), v = b.querySelector('.t-value');
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, hw = Math.max(r.width, 48) / 2 - 1, hh = Math.max(r.height, 48) / 2 - 1;
    const inView = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;   // buiten beeld: alleen de maat telt
    const hits = !inView ? [r.width >= 48 && r.height >= 48] : [[cx, cy], [cx - hw, cy], [cx + hw, cy], [cx, cy - hh], [cx, cy + hh]].map(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.tile') === b); });
    const vr = v.getBoundingClientRect();
    return { key: b.dataset.key, w: r.width, h: r.height, hit: { l: cx - hw - 1, r: cx + hw + 1, t: cy - hh - 1, b: cy + hh + 1 }, hitOk: hits.every(Boolean),
      clipped: vis(v) && (vr.width > r.width + 1 || body.scrollWidth > body.clientWidth + 1), inStage: r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1, value: v.textContent, bottom: r.bottom };
  });
  const hitOverlap = [];
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) { const a = tiles[i].hit, b = tiles[j].hit; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) hitOverlap.push(tiles[i].key + '/' + tiles[j].key); }
  const platesVisible = [...root.querySelectorAll('.ehm-plate')].filter(vis).length;
  const sum = root.querySelector('.ehc-summary').getBoundingClientRect();
  return { layout, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight, u: +k.toFixed(3), cover, tiles: tiles.map(({ hit, ...t }) => t),
    hitOverlap, badHit: tiles.filter(t => !t.hitOk).map(t => t.key), clipped: tiles.filter(t => t.clipped).map(t => t.key),
    tilesOutsideStage: tiles.filter(t => !t.inStage).map(t => t.key), platesVisible, summaryBottom: Math.round(sum.bottom),
    controlsOpen: root.querySelector('.ehc-controls').open, legend: root.querySelector('.ehm-legend').textContent };
};

// Witte, onverzadigde "glyf"-pixels binnen een kaart waarvan de eigen inhoud verborgen is ⇒ doorschijnende oude tekst.
function glyphPixels(png, inset) {
  let n = 0, white = 0;
  const x0 = Math.floor(png.w * inset), x1 = Math.ceil(png.w * (1 - inset)), y0 = Math.floor(png.h * inset), y1 = Math.ceil(png.h * (1 - inset));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const o = (y * png.w + x) * 4, r = png.data[o], g = png.data[o + 1], b = png.data[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    n++; if (mx > 175 && (mx - mn) / mx < 0.3) white++;
  }
  return n ? white / n : 0;
}

(async () => {
  if (WANT_SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await PW[ENGINE].launch();
  console.log(ENGINE, browser.version());
  const metrics = { engine: ENGINE, version: browser.version(), viewports: {} };
  const chromiumOnly = async (name, fn) => IS_CHROMIUM ? check(name, fn) : (results.push({ name, ok: true, info: 'overgeslagen (alleen Chromium/CDP)' }), console.log('SKIP', name, '(alleen Chromium/CDP)'));

  // ---------------------------------------------------------------- viewports: dekking, ondoorzichtig, tikvlakken, geen dubbele set
  const VIEWPORTS = [[320, 700, 'list'], [360, 740, 'compact'], [390, 844, 'compact'], [768, 1024, 'compact'], [1024, 768, 'overlay'], [1330, 748, 'overlay'], [1440, 900, 'overlay'], [1920, 1080, 'overlay']];
  for (const [w, h, layout] of VIEWPORTS) for (const sc of ['grote-waarden', 'zon-export']) {
    await check(`viewport ${w}x${h} (${sc}): ${layout}, dekking + ondoorzichtig basisvlak, tikvlakken ≥48px zonder overlap, geen afkapping/dubbele set, geen fouten`, async () => {
      served = [];
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=' + sc });
      const m = await page.evaluate(MEASURE);
      metrics.viewports[`${w}x${h}-${sc}`] = m;
      await ctx.close();
      assert.equal(m.layout, layout);
      assert.ok(m.scrollW <= m.innerW, 'horizontale scroll');
      assert.deepEqual(m.cover.filter(c => !c.contains || !c.opaque), [], 'dekking/ondoorzichtig');
      assert.deepEqual(m.badHit, [], 'tikvlak < 48 px of geblokkeerd');
      assert.deepEqual(m.hitOverlap, [], 'tikvlakken overlappen');
      assert.deepEqual(m.clipped, [], 'afgekapte waarde');
      if (layout !== 'list') { assert.deepEqual(m.tilesOutsideStage, [], 'dubbele set onder het beeld'); assert.equal(m.platesVisible, 0); }
      if (layout === 'compact' && h >= 700) { assert.ok(m.summaryBottom <= m.innerH, 'samenvatting niet in de eerste schermhoogte'); assert.equal(m.controlsOpen, false, 'scenario’s niet ingeklapt'); }
      assert.match(m.legend, /decoratief/);
      assert.deepEqual(errors, []);
      const img = served.filter(s => /\.webp$/.test(s.path));
      assert.equal(img.length, 1); assert.ok(img[0].path.endsWith('approved-visual-20261109.webp'));
      return { layout: m.layout, u: m.u, minSlackPx: Math.min(...m.cover.map(c => c.slack)), summaryBottom: m.summaryBottom };
    });
  }

  // ---------------------------------------------------------------- 200 % tekst ⇒ veilige lijstweergave
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    await check(`200% tekst ${w}x${h}: lijstweergave, geen horizontale scroll, niets afgekapt, dekking intact`, async () => {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=grote-waarden' });
      await page.addStyleTag({ content: 'html{font-size:200%}' }); await page.waitForTimeout(400);
      const m = await page.evaluate(MEASURE);
      await ctx.close();
      assert.equal(m.layout, 'list');
      assert.ok(m.scrollW <= m.innerW);
      assert.deepEqual(m.cover.filter(c => !c.contains || !c.opaque), []);
      assert.deepEqual(m.clipped, []);
      assert.deepEqual(errors, []);
      return { layout: m.layout };
    });
  }

  // ---------------------------------------------------------------- geen doorschijnende oude kaarttekst
  await check('glaskaarten: geen doorschijnende ingebakken tekst (kaartinhoud verborgen, witte-glyfpixels ≈ 0) op 390/768/1440', async () => {
    const out = {};
    for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?ticker=0&scenario=nul-watt' });
      await page.addStyleTag({ content: '.ehm-tiles .tile > *, .ehm-pill > * { visibility: hidden !important; } .ehm-tiles .tile { box-shadow: none !important; } .ehm-particles { display: none !important; }' });
      await page.waitForTimeout(200);
      const layout = await page.evaluate(() => document.querySelector('.ehc').dataset.layout);
      const sel = layout === 'list' ? '.ehm-plate' : '.ehm-tiles .tile';
      const keys = await page.$$eval(sel, n => n.map(e => e.dataset.key));
      for (const key of [...keys, 'pill']) {
        const loc = key === 'pill' ? page.locator('.ehm-pill') : page.locator(`${sel}[data-key="${key}"]`);
        const frac = glyphPixels(decodePng(await loc.screenshot()), 0.12);
        out[`${w}:${key}`] = +frac.toFixed(4);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    const bad = Object.entries(out).filter(([, v]) => v > 0.002);
    assert.deepEqual(bad, []);
    return out;
  });

  // ---------------------------------------------------------------- netstroom: kaart, kleur, pijl, tekst en richting kloppen altijd
  await check('alle scenario’s: lichtpunten = actieve routes; net: afname ↔ oranje ↑ net→huis, teruglevering ↔ cyaan ↓ huis→net; 0 W/offline: geen lichtpunten', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    const rows = await page.evaluate(ids => ids.map(id => {
      const c = window.__cockpits[0]; c.setScenario(id);
      const m = c.model, P = Object.fromEntries(c.particleInfo().map(p => [p.id, p]));
      const t = document.querySelector('.ehm-tiles .tile[data-key="net"]');
      const accent = getComputedStyle(t).getPropertyValue('--accent').trim();
      return { id, dir: m.grid.direction, routes: Object.fromEntries(Object.entries(m.routes).map(([k, r]) => [k, r.active])), P,
        net: { dataDir: t.dataset.direction, extra: t.querySelector('.t-extra').hidden ? '' : t.querySelector('.t-extra').textContent, sub: t.querySelector('.t-sub').textContent, value: t.querySelector('.t-value').textContent, accent } };
    }), M.SCENARIO_IDS);
    await ctx.close();
    const problems = [];
    for (const r of rows) {
      const want = { 'flow-pv': r.routes['sun-home'], 'flow-practice': r.routes['home-practice'], 'flow-net': r.routes['home-grid'] || r.routes['grid-home'], 'flow-car': r.routes['home-ev'] };
      for (const [f, a] of Object.entries(want)) if (r.P[f].active !== a) problems.push(`${r.id}: ${f} actief=${r.P[f].active}, model=${a}`);
      if (r.routes['grid-home'] && !(r.P['flow-net'].dir === -1 && r.P['flow-net'].color === '#FF8A3D' && r.net.dataDir === 'import' && r.net.extra === '↑ van net' && /Afname/.test(r.net.sub) && r.net.accent === '#ff8a3d')) problems.push(r.id + ': afname inconsistent ' + JSON.stringify(r.net));
      if (r.routes['home-grid'] && !(r.P['flow-net'].dir === 1 && r.P['flow-net'].color === '#3FE6F2' && r.net.dataDir === 'export' && r.net.extra === '↓ naar net' && /Teruglevering/.test(r.net.sub) && r.net.value.startsWith('−') && r.net.accent === '#3fe6f2')) problems.push(r.id + ': teruglevering inconsistent ' + JSON.stringify(r.net));
      if (!r.routes['grid-home'] && !r.routes['home-grid'] && (r.net.extra || ['import', 'export'].includes(r.net.dataDir) || /^(Afname|Teruglevering)/.test(r.net.sub))) problems.push(r.id + ': richting getoond zonder actieve netroute ' + JSON.stringify(r.net));
    }
    for (const id of ['nul-watt', 'offline']) { const r = rows.find(x => x.id === id); if (Object.values(r.P).some(p => p.active)) problems.push(id + ': lichtpunten actief'); }
    assert.deepEqual(problems, []);
    assert.deepEqual(errors, []);
    return { scenarios: rows.length, afname: rows.filter(r => r.routes['grid-home']).map(r => r.id), teruglevering: rows.filter(r => r.routes['home-grid']).map(r => r.id) };
  });

  // ---------------------------------------------------------------- master onaangetast; bij 0 W/offline is de lichtpuntlaag leeg
  await check('master onaangetast: geen beeldbewerkingslagen; lichtpuntlaag leeg bij 0 W en offline (alleen decoratieve lijnen zichtbaar)', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0' });
    const r = await page.evaluate(async () => {
      const c = window.__cockpits[0], stage = document.querySelector('.ehm-stage');
      const layers = [...stage.children].map(e => e.className);
      const empty = async id => { c.setScenario(id); await new Promise(res => setTimeout(res, 900)); const cv = stage.querySelector('.ehm-particles'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
      const act = await empty('zon-export');
      return { layers, imgSrc: stage.querySelector('img').getAttribute('src'), nonEmptyActive: act, nulWatt: await empty('nul-watt'), offline: await empty('offline'), canvases: stage.querySelectorAll('canvas').length };
    });
    await ctx.close();
    assert.deepEqual(r.layers, ['ehm-scene', 'ehm-particles', 'ehm-covers']);
    assert.equal(r.canvases, 1);
    errors.splice(0, errors.length, ...errors.filter(e => !/willReadFrequently/.test(e)));   // waarschuwing van de meting zelf
    assert.ok(r.nonEmptyActive > 0, 'actief: lichtpunten getekend');
    assert.equal(r.nulWatt, 0); assert.equal(r.offline, 0);
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- lichtpunten bewegen alleen bij actief
  await check('lichtpunten: bewegen alleen op actieve routes, in stroomrichting; bij offline direct stil', async () => {
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
    assert.ok(frozen); assert.ok(idle);
    assert.deepEqual(errors, []);
    return { r1, frozen, idle };
  });

  // ---------------------------------------------------------------- inhoud
  await check('inhoud: DEMO, batterij = Simulatie, praktijk "Nog niet gekoppeld", minteken U+2212, legenda decoratief, geen ingebakken voorbeeldwaarden', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    const info = await page.evaluate(() => {
      const r = document.querySelector('.ehc'), t = k => r.querySelector(`.ehm-tiles .tile[data-key="${k}"]`);
      return { badge: r.querySelector('.ehc-demo').textContent, pill: r.querySelector('.ehm-pill').textContent, battery: t('battery').textContent, practice: t('practice').textContent, net: t('net').querySelector('.t-value').textContent, house: t('house').querySelector('.t-value').textContent, legend: r.querySelector('.ehm-legend').textContent, alt: r.querySelector('.ehm-scene').alt };
    });
    await ctx.close();
    assert.match(info.badge, /DEMO — fictieve meetwaarden/); assert.match(info.pill, /DEMO/);
    assert.match(info.battery, /Simulatie/); assert.match(info.battery, /Geen fysieke opslag/);
    assert.match(info.practice, /Nog niet gekoppeld/);
    assert.equal(info.net.charAt(0), '−');
    assert.notEqual(info.house, '2,14 kW');
    assert.match(info.legend, /decoratief en tonen geen actuele stroom/); assert.match(info.alt, /decoratief/);
    assert.deepEqual(errors, []);
    return info;
  });

  await check('50 hertekeningen: geen DOM-rebuild, geen richtings-/toonflikkering', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=zon-export' });
    const r = await page.evaluate(async () => {
      const c = window.__cockpits[0]; let structural = 0, flips = 0;
      const mo = new MutationObserver(list => { for (const m of list) { if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1)) structural++; if (m.type === 'attributes') flips++; } });
      mo.observe(c.el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-direction', 'data-tone', 'data-layout'] });
      for (let i = 0; i < 50; i++) { c.step(); await new Promise(res => setTimeout(res, 15)); }
      mo.disconnect(); return { structural, flips };
    });
    await ctx.close();
    assert.deepEqual(r, { structural: 0, flips: 0 });
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- terugval
  await check('terugval: geen scènedata / beeld laadt niet ⇒ alleen interface (lijst), geen JS-fouten', async () => {
    const out = {};
    for (const [name, q] of [['geen-scene', '?ticker=0&masterScene=0'], ['beeld-404', '?ticker=0&masterBase=missing']]) {
      const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: q, wait: false });
      await page.waitForTimeout(800);
      out[name] = await page.evaluate(() => { const r = document.querySelector('.ehc'); return { scene: r.dataset.scene, layout: r.dataset.layout, note: r.querySelector('.ehc-scene-note').textContent, stageVisible: getComputedStyle(r.querySelector('.ehm-stage')).display !== 'none', tiles: r.querySelectorAll('.ehm-tiles .tile').length, value: r.querySelector('.tile[data-key="house"] .t-value').textContent }; });
      out[name].errors = errors.filter(e => !/Failed to load resource|404/.test(e));
      await ctx.close();
    }
    assert.equal(out['geen-scene'].scene, 'missing'); assert.equal(out['beeld-404'].scene, 'error');
    for (const v of Object.values(out)) { assert.equal(v.layout, 'list'); assert.equal(v.stageVisible, false); assert.equal(v.tiles, 6); assert.notEqual(v.value, '—'); assert.deepEqual(v.errors, []); }
    return out;
  });
  await check('file:// (canvas mogelijk geblokkeerd): glasbasisvlak valt terug op vaste tint, kaarten blijven dekkend', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, url: 'file://' + path.join(ROOT, 'pve-04', 'index.html') + '?ticker=0&scenario=nul-watt' });
    const r = await page.evaluate(MEASURE);
    const tint = await page.evaluate(() => document.querySelector('.ehc').dataset.tint);
    await ctx.close();
    assert.ok(['ok', 'fallback'].includes(tint), tint);
    assert.deepEqual(r.cover.filter(c => !c.contains || !c.opaque), []);
    assert.deepEqual(errors.filter(e => !/getImageData|tainted|insecure|SecurityError|willReadFrequently/i.test(e)), []);
    return { tint, layout: r.layout };
  });

  // ---------------------------------------------------------------- toetsenbord, scenario's inklapbaar, reduced motion, instanties
  await check('toetsenbord: Tab → kaart, Enter opent detail, Escape sluit; scenario’s in- en uitklapbaar', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 390, height: 844, query: '?ticker=0' });
    let key = null;
    for (let i = 0; i < 12 && !key; i++) { await page.keyboard.press('Tab'); key = await page.evaluate(() => document.activeElement.closest('.tile') ? document.activeElement.dataset.key : null); }
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => ({ open: !document.querySelector('.ehc-detail').hidden, focus: document.activeElement.className }));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({ hidden: document.querySelector('.ehc-detail').hidden, focusKey: document.activeElement.dataset.key }));
    const before = await page.evaluate(() => document.querySelector('.ehc-controls').open);
    await page.click('.ehc-controls > summary');
    const after = await page.evaluate(() => ({ open: document.querySelector('.ehc-controls').open, chipH: document.querySelector('.ehc-scenarios .chip').getBoundingClientRect().height, sumH: document.querySelector('.ehc-controls > summary').getBoundingClientRect().height }));
    await ctx.close();
    assert.ok(key); assert.equal(opened.open, true); assert.equal(opened.focus, 'd-close'); assert.equal(closed.hidden, true); assert.equal(closed.focusKey, key);
    assert.equal(before, false); assert.equal(after.open, true); assert.ok(after.chipH >= 48 && after.sumH >= 48);
    assert.deepEqual(errors, []);
    return { key, after };
  });
  await check('prefers-reduced-motion: geen animatielus, richting via pijlen op actieve routes', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 900, query: '?ticker=0&scenario=net-laden', reducedMotion: 'reduce' });
    const r = await page.evaluate(async () => { const c = window.__cockpits[0]; const a = c.phases('flow-net'); await new Promise(res => setTimeout(res, 400)); return { animating: c.isAnimating(), same: JSON.stringify(a) === JSON.stringify(c.phases('flow-net')), net: c.particleInfo().find(p => p.id === 'flow-net') }; });
    await ctx.close();
    assert.equal(r.animating, false); assert.equal(r.same, true); assert.equal(r.net.dir, -1); assert.equal(r.net.color, '#FF8A3D');
    assert.deepEqual(errors, []);
    return r;
  });
  await check('twee instanties onafhankelijk; destroy() ruimt timers, rAF en DOM op', async () => {
    const { ctx, page, errors } = await open(browser, base, { width: 1440, height: 1800, query: '?instances=2' });
    const out = await page.evaluate(async () => {
      const [a, b] = window.__cockpits; const start = { a: a.scenario, b: b.scenario };
      a.setScenario('offline'); const indep = b.particleInfo().find(p => p.id === 'flow-car').active === true && a.particleInfo().every(p => !p.active);
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
  await chromiumOnly('performance: fps (1× en 4× CPU) met actieve lichtpunten, hoofdthread-rekentijd ≤ 150 ms, geheugen na 200 updates', async () => {
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
    const tintMs = await page.evaluate(() => +document.querySelector('.ehc').dataset.tintMs);
    await ctx.close();
    assert.deepEqual(errors, []);
    const out = { fps1x: s1.fps, p95_1x: s1.p95, fps4x: s4.fps, p95_4x: s4.p95, mainThreadTintMs: tintMs, heapDeltaKB: Math.round((h1 - h0) / 1024),
      verdict4x: s4.fps < 30 ? 'FOUT (< 30 fps)' : s4.fps < 45 ? 'DOEL NIET GEHAALD' : s4.fps < 50 ? 'WAARSCHUWING (45–49)' : 'DOEL (≥ 50 fps)' };
    assert.ok(s4.fps >= 50, '≥ 50 fps bij 4×');
    assert.ok(tintMs <= 150, 'hoofdthread ≤ 150 ms');
    assert.ok(out.heapDeltaKB < 2048, 'geheugengroei');
    metrics.performance = out;
    return out;
  });

  // ---------------------------------------------------------------- screenshots
  if (WANT_SHOTS) {
    await check('screenshots: desktop en mobiel × actief / 0 W / offline (+ netafname)', async () => {
      const files = [];
      const sets = [['desktop', 1440, 900], ['mobiel', 390, 844]];
      const states = [['actief', 'zon-export'], ['0w', 'nul-watt'], ['offline', 'offline'], ['afname', 'net-laden']];
      for (const [vp, w, h] of sets) for (const [state, sc] of states) {
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
