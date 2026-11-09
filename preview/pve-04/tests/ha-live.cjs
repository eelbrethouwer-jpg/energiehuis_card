'use strict';
/*
 * PVE-04 HA-01 · browseracceptatie van de alleen-lezen LIVE-cockpit met GESIMULEERDE Home Assistant-states.
 *   node preview/pve-04/tests/ha-live.cjs [--browser=webkit] [--screenshots]
 * Geen echte Home Assistant: tools/serve-ha-preview.cjs bootst de frontendstates en de getekende /media-route na.
 */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const PW = require(require.resolve('playwright', { paths: [process.cwd(), __dirname] }));
const { createServer } = require('../tools/serve-ha-preview.cjs');
const SIM = require('../ha/sim.js');
const ENGINE = (process.argv.find(a => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
const IS_CHROMIUM = ENGINE === 'chromium';
const WANT_SHOTS = process.argv.includes('--screenshots');
const SHOTS = path.join(__dirname, '..', 'screenshots');

const results = []; let failed = 0;
async function check(name, fn) {
  try { const info = await fn(); results.push({ name, ok: true, info }); console.log('PASS', name, info ? JSON.stringify(info).slice(0, 300) : ''); }
  catch (e) { failed++; results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '-', process.env.EH_VERBOSE ? e.stack : e.message.split('\n')[0]); }
}
const INSTRUMENT = () => {
  const live = { intervals: new Set(), rafs: new Set(), timeouts: new Set() };
  const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, ct = window.clearTimeout, ra = window.requestAnimationFrame, ca = window.cancelAnimationFrame;
  window.setInterval = function (...a) { const id = si.apply(this, a); live.intervals.add(id); return id; };
  window.clearInterval = function (id) { live.intervals.delete(id); return ci.call(this, id); };
  window.setTimeout = function (fn, ms, ...r) { let id; id = st.call(this, (...x) => { live.timeouts.delete(id); typeof fn === 'function' && fn(...x); }, ms, ...r); live.timeouts.add(id); return id; };
  window.clearTimeout = function (id) { live.timeouts.delete(id); return ct.call(this, id); };
  window.requestAnimationFrame = function (cb) { let id; id = ra.call(this, t => { live.rafs.delete(id); cb(t); }); live.rafs.add(id); return id; };
  window.cancelAnimationFrame = function (id) { live.rafs.delete(id); return ca.call(this, id); };
  window.__live = live;
};
async function open(browser, base, { width = 1440, height = 900, query = '', reducedMotion = 'no-preference', dpr = 1, waitScene = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INSTRUMENT);
  await page.goto(base + '/pve-04/ha/index.html' + query);
  await page.waitForFunction('window.__mounted === true');
  if (waitScene) await page.waitForFunction(() => { const r = window.__ha.card.shadowRoot.querySelector('.ehc'); return r && r.dataset.scene !== 'loading' && (r.dataset.scene !== 'ok' || r.dataset.tint !== 'none'); }, null, { timeout: 15000 });
  await page.waitForTimeout(350);
  return { ctx, page, errors };
}
// Toestand van de LIVE-kaart (in de shadow root)
const STATE = () => {
  const card = window.__ha.card, sr = card.shadowRoot, r = sr.querySelector('.ehc'), c = card.debug.cockpit, m = c.model;
  const t = k => sr.querySelector(`.ehm-tiles .tile[data-key="${k}"]`);
  const net = t('net');
  return {
    mode: r.dataset.mode, layout: r.dataset.layout, scene: r.dataset.scene, note: sr.querySelector('.ehc-scene-note').textContent,
    status: sr.querySelector('.ehc-status').textContent, text: r.textContent, controls: !!sr.querySelector('.ehc-controls'),
    routes: Object.entries(m.routes).filter(([, x]) => x.active).map(([k]) => k).sort(),
    particles: c.particleInfo().filter(p => p.active).map(p => p.route).sort(), parts: c.particleInfo(),
    net: { value: net.querySelector('.t-value').textContent, dir: net.dataset.direction, extra: net.querySelector('.t-extra').hidden ? '' : net.querySelector('.t-extra').textContent, sub: net.querySelector('.t-sub').textContent },
    pv: { value: t('pv').querySelector('.t-value').textContent, sub: t('pv').querySelector('.t-sub').textContent, tone: t('pv').dataset.tone },
    updates: card.debug.updates, imgSrc: sr.querySelector('.ehm-scene').getAttribute('src') || ''
  };
};

(async () => {
  if (WANT_SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const log = [];
  const srv = createServer({ log });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await PW[ENGINE].launch();
  console.log(ENGINE, browser.version());
  const metrics = { engine: ENGINE, version: browser.version() };

  // ---------------------------------------------------------------- alle gesimuleerde scenario's
  await check('alle 15 gesimuleerde HA-scenario’s: LIVE zonder DEMO/fictief/scenario’s; lichtpunten = actieve routes; netrichting consistent; geen fouten', async () => {
    const { ctx, page, errors } = await open(browser, base);
    const out = {};
    for (const id of Object.keys(SIM.SCENARIOS)) {
      await page.evaluate(sc => window.__ha.set(sc), id);
      await page.waitForFunction(() => { const r = window.__ha.card.shadowRoot.querySelector('.ehc'); return r && r.dataset.scene !== 'loading'; });
      await page.waitForTimeout(120);
      out[id] = await page.evaluate(STATE);
    }
    await ctx.close();
    const problems = [];
    for (const [id, s] of Object.entries(out)) {
      if (s.mode !== 'live') problems.push(id + ': niet live');
      if (/DEMO|fictiev|Schommeling|scenario/i.test(s.text) || s.controls) problems.push(id + ': DEMO-tekst of scenario’s in LIVE');
      if (JSON.stringify(s.particles) !== JSON.stringify(s.routes.filter(r => r !== 'home-practice'))) problems.push(id + ': lichtpunten ≠ routes ' + JSON.stringify([s.particles, s.routes]));
      const imp = s.routes.includes('grid-home'), exp = s.routes.includes('home-grid');
      if (imp && !(s.net.dir === 'import' && s.net.extra === '↑ van net')) problems.push(id + ': afname inconsistent');
      if (exp && !(s.net.dir === 'export' && s.net.extra === '↓ naar net' && s.net.value.startsWith('−'))) problems.push(id + ': teruglevering inconsistent');
      if (!imp && !exp && (s.net.extra || ['import', 'export'].includes(s.net.dir))) problems.push(id + ': richting zonder netroute');
    }
    const want = { afname: ['grid-home', 'home-ev', 'sun-home'], teruglevering: ['home-grid', 'sun-home'], zonneladen: ['home-ev', 'home-grid', 'sun-home'], 'nul-watt': [], offline: [], unavailable: [], tegenstrijdig: [], 'p1-omgekeerd': ['home-grid', 'sun-home'], 'p1-omgekeerd-fout': [], verouderd: ['sun-home'], 'constant-nacht': ['grid-home'] };
    for (const [id, r] of Object.entries(want)) if (JSON.stringify(out[id].routes) !== JSON.stringify(r)) problems.push(id + ': routes ' + JSON.stringify(out[id].routes));
    if (out.offline.status !== 'Offline' || !/OFFLINE/.test(out.offline.text)) problems.push('offline-status/pil');
    if (/OFFLINE/.test(out.zonneladen.text)) problems.push('zonneladen: OFFLINE-pil');
    if (!/Laatste stand/.test(out['constant-nacht'].pv.sub) || out['constant-nacht'].pv.tone !== 'warn') problems.push('constant-nacht: laatste stand');
    if (!/Onbekende eenheid/.test(out['eenheid-fout'].net.sub)) problems.push('eenheid-fout');
    assert.deepEqual(problems, []);
    assert.deepEqual(errors, []);
    return Object.fromEntries(Object.entries(out).map(([k, s]) => [k, s.status + ' · ' + (s.routes.join(',') || '-')]));
  });

  // ---------------------------------------------------------------- snelle updates, onveranderde data
  await check('snelle opeenvolgende updates: 200 hass-objecten in één burst ⇒ samengevoegd per frame, geen DOM-herbouw, laatste waarde getoond', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering' });
    const r = await page.evaluate(async () => {
      const card = window.__ha.card, root = card.shadowRoot.querySelector('.ehc'), u0 = card.debug.updates;
      let structural = 0; const mo = new MutationObserver(l => { for (const m of l) if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1)) structural++; });
      mo.observe(root, { subtree: true, childList: true });
      const h0 = window.__ha.hass, id = 'sensor.p1_meter_vermogen';
      for (let i = 1; i <= 200; i++) { const st = { ...h0.states[id], state: String(-1000 - i), last_updated: new Date().toISOString(), last_reported: new Date().toISOString() }; window.__ha.push({ ...h0, states: { ...h0.states, [id]: st } }); }
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const u1 = card.debug.updates;
      // nieuw hass-object met DEZELFDE state-objecten ⇒ geen nieuwe modelberekening
      const h = window.__ha.hass; for (let i = 0; i < 20; i++) window.__ha.push({ ...h });
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      mo.disconnect();
      return { burstUpdates: u1 - u0, unchangedUpdates: card.debug.updates - u1, structural, value: card.shadowRoot.querySelector('.tile[data-key="net"] .t-value').textContent };
    });
    await ctx.close();
    assert.ok(r.burstUpdates >= 1 && r.burstUpdates <= 3, 'burst ' + r.burstUpdates);
    assert.equal(r.unchangedUpdates, 0); assert.equal(r.structural, 0);
    assert.equal(r.value, '−1,20 kW');
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- veroudering zonder nieuwe update stopt de lichtpunten
  await check('veroudering zonder nieuwe HA-update: P1 passeert de TTL ⇒ netroute en lichtpunten stoppen via één timer', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering' });
    const r = await page.evaluate(async () => {
      const card = window.__ha.card, c = card.debug.cockpit, h = window.__ha.hass, id = 'sensor.p1_meter_vermogen';
      const t = new Date(Date.now() - 298500).toISOString();
      window.__ha.push({ ...h, states: { ...h.states, [id]: { ...h.states[id], state: '-1880', last_updated: t, last_changed: t } } });
      await new Promise(res => setTimeout(res, 200));
      const before = c.particleInfo().find(p => p.id === 'flow-net').active;
      await new Promise(res => setTimeout(res, 2200));
      const after = c.particleInfo().find(p => p.id === 'flow-net').active;
      return { before, after, sub: card.shadowRoot.querySelector('.tile[data-key="net"] .t-sub').textContent, timers: window.__live.timeouts.size };
    });
    await ctx.close();
    assert.equal(r.before, true); assert.equal(r.after, false); assert.match(r.sub, /Verouderd/);
    assert.ok(r.timers <= 2, 'timers ' + r.timers);
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- ontkoppelen en opnieuw koppelen
  await check('ontkoppelen ⇒ geen timers, rAF of listeners actief; opnieuw koppelen ⇒ zelfde DOM, werkt verder', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=zonneladen' });
    const r = await page.evaluate(async () => {
      const card = window.__ha.card, rootBefore = card.shadowRoot.querySelector('.ehc'), parent = card.parentNode;
      card.remove();
      await new Promise(res => setTimeout(res, 300));
      const detached = { timeouts: window.__live.timeouts.size, rafs: window.__live.rafs.size, intervals: window.__live.intervals.size, suspended: card.debug.cockpit.suspended };
      window.__ha.set('afname');                                      // hass-updates terwijl ontkoppeld
      await new Promise(res => setTimeout(res, 200));
      const whileDetached = { rafs: window.__live.rafs.size, updates: card.debug.updates };
      parent.appendChild(card);
      await new Promise(res => setTimeout(res, 400));
      const st = card.debug.cockpit;
      return { detached, whileDetached, sameDom: card.shadowRoot.querySelector('.ehc') === rootBefore, suspendedAfter: st.suspended, routes: Object.entries(st.model.routes).filter(([, x]) => x.active).map(([k]) => k).sort(), animating: st.isAnimating() };
    });
    await ctx.close();
    assert.deepEqual(r.detached, { timeouts: 0, rafs: 0, intervals: 0, suspended: true });
    assert.equal(r.whileDetached.rafs, 0);
    assert.equal(r.sameDom, true); assert.equal(r.suspendedAfter, false);
    assert.deepEqual(r.routes, ['grid-home', 'home-ev', 'sun-home']); assert.equal(r.animating, true);
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- afgeschermde beeldroute (gesimuleerd)
  await check('beeldroute: master alleen via getekende /media-URL (media_source/resolve_media); zonder handtekening 401', async () => {
    log.length = 0;
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering' });
    const s = await page.evaluate(STATE);
    const direct = await page.evaluate(async () => (await fetch('/media/local/energiehuis/approved-visual-20261109.webp')).status);
    const forged = await page.evaluate(async () => (await fetch('/media/local/energiehuis/approved-visual-20261109.webp?authSig=x.y')).status);
    const outside = await page.evaluate(() => [EhHaLiveCard.safeResolvedUrl('https://evil.example/media/x.webp', location.origin), EhHaLiveCard.safeResolvedUrl('/local/x.webp', location.origin), EhHaLiveCard.safeResolvedUrl('/media/../config/x', location.origin), EhHaLiveCard.safeResolvedUrl('//evil.example/media/x', location.origin)]);
    await ctx.close();
    const media = log.filter(l => l.path.startsWith('/media/') && /authSig=/.test(l.query));
    assert.equal(s.scene, 'ok'); assert.match(s.imgSrc, /\/media\/local\/energiehuis\/approved-visual-20261109\.webp\?authSig=/);
    assert.ok(media.length >= 1); assert.ok(!log.some(l => l.path.includes('pve-03/reference')), 'master via openbaar pad geladen');
    assert.equal(direct, 401); assert.equal(forged, 403);
    assert.deepEqual(outside, [null, null, null, null]);
    assert.deepEqual(errors.filter(e => !/401|403|Failed to load resource/.test(e)), []);
    return { scene: s.scene, direct, forged };
  });
  await check('beeldroute: verlopen handtekening ⇒ één keer opnieuw oplossen, daarna veilige terugval (alleen interface); geen beeld geconfigureerd ⇒ terugval', async () => {
    const res = {};
    for (const [name, q] of [['verlopen', '?scenario=teruglevering&signTtl=0'], ['geen-beeld', '?scenario=teruglevering&img=0']]) {
      log.length = 0;
      const { ctx, page, errors } = await open(browser, base, { query: q });
      await page.waitForTimeout(600);
      const s = await page.evaluate(STATE);
      res[name] = { scene: s.scene, layout: s.layout, note: s.note, resolves: await page.evaluate(() => window.__ha.resolves), mediaRequests: log.filter(l => l.path.startsWith('/media/')).length, routes: s.routes, errors: errors.filter(e => !/40[13]|Failed to load resource/.test(e)) };
      await ctx.close();
    }
    assert.equal(res.verlopen.scene, 'error'); assert.equal(res.verlopen.layout, 'list'); assert.equal(res.verlopen.resolves, 2);
    assert.deepEqual(res.verlopen.routes, ['home-grid', 'sun-home'], 'data blijft werken');
    assert.equal(res['geen-beeld'].scene, 'error'); assert.match(res['geen-beeld'].note, /Geen beeld geconfigureerd/); assert.equal(res['geen-beeld'].mediaRequests, 0);
    for (const v of Object.values(res)) assert.deepEqual(v.errors, []);
    return res;
  });

  // ---------------------------------------------------------------- DEMO en LIVE strikt gescheiden
  await check('DEMO en LIVE strikt gescheiden: DEMO-pagina toont DEMO + scenario’s, LIVE-kaart geen van beide', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
    await page.goto(base + '/pve-04/index.html?ticker=0'); await page.waitForTimeout(800);
    const demo = await page.evaluate(() => ({ badge: document.querySelector('.ehc-demo').textContent, controls: !!document.querySelector('.ehc-controls'), mode: document.querySelector('.ehc').dataset.mode || 'demo' }));
    await ctx.close();
    const { ctx: c2, page: p2 } = await open(browser, base, { query: '?scenario=zonneladen' });
    const live = await p2.evaluate(() => { const sr = window.__ha.card.shadowRoot; return { badge: sr.querySelector('.ehc-demo').textContent, pill: sr.querySelector('.ehm-pill').textContent, controls: !!sr.querySelector('.ehc-controls'), detailNote: sr.querySelector('.d-note').textContent, ticker: window.__live.intervals.size }; });
    await c2.close();
    assert.match(demo.badge, /DEMO/); assert.equal(demo.controls, true); assert.equal(demo.mode, 'demo');
    assert.match(live.badge, /LIVE · alleen-lezen/); assert.doesNotMatch(live.pill, /DEMO/); assert.equal(live.controls, false);
    assert.match(live.detailNote, /geen servicecalls/); assert.equal(live.ticker, 0);
    return { demo, live };
  });

  // ---------------------------------------------------------------- weergaven, reduced motion
  for (const [w, h, layout] of [[320, 700, 'list'], [390, 844, 'compact'], [1440, 900, 'overlay']]) {
    await check(`weergave ${w}x${h}: ${layout}, geen horizontale scroll, kaarten dekken de ingebakken kaarten, detailpaneel werkt`, async () => {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?scenario=afname' });
      const r = await page.evaluate(() => {
        const sr = window.__ha.card.shadowRoot, root = sr.querySelector('.ehc'), S = window.EhPve04MasterScene, stage = sr.querySelector('.ehm-stage').getBoundingClientRect();
        const layout = root.dataset.layout, bad = [];
        for (const [key, c] of Object.entries(S.covers)) {
          const node = key === 'pill' ? sr.querySelector('.ehm-pill') : layout === 'list' ? sr.querySelector(`.ehm-plate[data-key="${key}"]`) : sr.querySelector(`.ehm-tiles .tile[data-key="${key}"]`);
          const rr = node.getBoundingClientRect(), b = c.baked;
          if (rr.left > stage.left + b.x * stage.width + 0.5 || rr.top > stage.top + b.y * stage.height + 0.5 || rr.right < stage.left + (b.x + b.w) * stage.width - 0.5 || rr.bottom < stage.top + (b.y + b.h) * stage.height - 0.5) bad.push(key);
        }
        const btn = sr.querySelector('.ehm-tiles .tile[data-key="net"]'); btn.click();
        const d = sr.querySelector('.ehc-detail'), rows = [...d.querySelectorAll('dt')].map(x => x.textContent);
        return { layout, bad, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, detailOpen: !d.hidden, rows };
      });
      await ctx.close();
      assert.equal(r.layout, layout); assert.deepEqual(r.bad, []); assert.ok(r.scrollW <= r.innerW);
      assert.equal(r.detailOpen, true); assert.ok(r.rows.includes('Entiteit') && r.rows.includes('Richting') && r.rows.includes('Tijdstempel'), JSON.stringify(r.rows));
      assert.deepEqual(errors, []);
      return { layout: r.layout };
    });
  }
  await check('prefers-reduced-motion: geen animatielus, richting via pijlen', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=afname', reducedMotion: 'reduce' });
    const r = await page.evaluate(async () => { const c = window.__ha.card.debug.cockpit, a = c.phases('flow-net'); await new Promise(res => setTimeout(res, 400)); return { animating: c.isAnimating(), same: JSON.stringify(a) === JSON.stringify(c.phases('flow-net')), net: c.particleInfo().find(p => p.id === 'flow-net') }; });
    await ctx.close();
    assert.equal(r.animating, false); assert.equal(r.same, true); assert.equal(r.net.dir, -1); assert.equal(r.net.color, '#FF8A3D');
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- screenshots
  if (WANT_SHOTS) {
    await check('screenshots LIVE (gesimuleerde HA): desktop en mobiel × zonneladen / afname / 0 W / offline / nacht', async () => {
      const files = [];
      for (const [vp, w, h] of [['desktop', 1440, 900], ['mobiel', 390, 844]]) for (const sc of ['zonneladen', 'afname', 'nul-watt', 'offline', 'constant-nacht']) {
        const { ctx, page } = await open(browser, base, { width: w, height: h, query: '?scenario=' + sc, dpr: vp === 'mobiel' ? 2 : 1 });
        await page.waitForTimeout(600);
        const f = `ha-live-${vp}-${sc}${IS_CHROMIUM ? '' : '-' + ENGINE}.jpg`;
        await page.locator('energiehuis-live-cockpit-preview').screenshot({ path: path.join(SHOTS, f), type: 'jpeg', quality: 82 });
        files.push(f); await ctx.close();
      }
      return files;
    });
  }

  await browser.close(); srv.close();
  metrics.results = results.map(r => ({ name: r.name, ok: r.ok }));
  if (WANT_SHOTS) fs.writeFileSync(path.join(SHOTS, IS_CHROMIUM ? 'ha-live-metrics.json' : `ha-live-metrics-${ENGINE}.json`), JSON.stringify(metrics, null, 2) + '\n');
  console.log(`\n${results.length - failed}/${results.length} HA-LIVE-controles geslaagd (${ENGINE} ${metrics.version})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
