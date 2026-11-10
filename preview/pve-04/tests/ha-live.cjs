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
    updates: card.debug.updates, imgSrc: sr.querySelector('.ehm-scene').getAttribute('src') || '',
    badge: { text: sr.querySelector('.ehc-demo').textContent, state: sr.querySelector('.ehc-demo').dataset.state, bg: getComputedStyle(sr.querySelector('.ehc-demo')).backgroundColor },
    pill: { text: sr.querySelector('.ehm-pill').textContent, state: sr.querySelector('.ehm-pill').dataset.state, bg: getComputedStyle(sr.querySelector('.ehm-pill .p-demo')).backgroundColor },
    warnTone: sr.querySelector('.ehc-warn').hidden ? null : sr.querySelector('.ehc-warn').dataset.tone,
    cupra: { value: t('cupra').querySelector('.t-value').textContent, sub: t('cupra').querySelector('.t-sub').textContent }
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
  await check('alle ' + Object.keys(SIM.SCENARIOS).length + ' gesimuleerde HA-scenario’s: LIVE zonder DEMO/fictief/scenario’s; lichtpunten = actieve routes; netrichting consistent; geen fouten', async () => {
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
      if (!imp && !exp && ((s.net.extra && !['P1-meting', 'P1 · richting onbevestigd'].includes(s.net.extra)) || ['import', 'export'].includes(s.net.dir))) problems.push(id + ': richting zonder netroute');
    }
    const want = { afname: ['grid-home', 'home-ev', 'sun-home'], teruglevering: ['home-grid', 'sun-home'], zonneladen: ['home-ev', 'home-grid', 'sun-home'], 'nul-watt': [], offline: [], unavailable: [], tegenstrijdig: [], 'p1-omgekeerd': ['home-grid', 'sun-home'], 'p1-omgekeerd-fout': [], verouderd: ['sun-home'], 'constant-nacht': ['grid-home'], 'deels-vertraagd': ['home-grid'], 'niet-synchroon': [] };
    for (const [id, r] of Object.entries(want)) if (JSON.stringify(out[id].routes) !== JSON.stringify(r)) problems.push(id + ': routes ' + JSON.stringify(out[id].routes));
    if (out.offline.status !== 'Offline' || !/OFFLINE/.test(out.offline.text)) problems.push('offline-status/pil');
    if (/OFFLINE/.test(out.zonneladen.text)) problems.push('zonneladen: OFFLINE-pil');
    // RC1-C: offline nergens groen; kop en pil zeggen hetzelfde
    if (out.offline.badge.state !== 'offline' || out.offline.pill.state !== 'offline' || !/^OFFLINE/.test(out.offline.badge.text) || /LIVE/.test(out.offline.badge.text + out.offline.pill.text)) problems.push('offline: kop/pil ' + JSON.stringify([out.offline.badge, out.offline.pill]));
    if (out.zonneladen.badge.state !== 'live' || out.zonneladen.pill.state !== 'live') problems.push('zonneladen: niet groen LIVE');
    for (const id of ['deels-vertraagd', 'niet-synchroon', 'tegenstrijdig', 'verouderd']) if (out[id].badge.state !== 'degraded') problems.push(id + ': kop niet oranje');
    if (!/Niet live · bevestigd 10 min geleden/.test(out['deels-vertraagd'].pv.sub) || out['deels-vertraagd'].pv.value !== '4,82 kW') problems.push('deels-vertraagd: pv ' + JSON.stringify(out['deels-vertraagd'].pv));
    if (!/Niet live/.test(out['deels-vertraagd'].cupra.sub)) problems.push('deels-vertraagd: cupra');
    if (out['niet-synchroon'].status !== 'Meetketen niet synchroon' || /Controle nodig/.test(out['niet-synchroon'].text)) problems.push('niet-synchroon: status');
    if (out.tegenstrijdig.status !== 'Controle nodig') problems.push('tegenstrijdig: status');
    // RC2: zonder bevestigde richting geen minteken, geen pijl, expliciet P1-label
    for (const id of ['tegenstrijdig', 'niet-synchroon', 'p1-omgekeerd-fout']) {
      const n = out[id].net;
      if (/[−-]/.test(n.value) || n.extra !== 'P1-meting' || n.dir !== 'unconfirmed' || n.sub !== 'Richting niet bevestigd') problems.push(id + ': net ' + JSON.stringify(n));
    }
    if (!out.teruglevering.net.value.startsWith('−') || out.teruglevering.net.dir !== 'export') problems.push('teruglevering: net normaal');
    if (out['niet-synchroon'].warnTone !== 'warn' || out.tegenstrijdig.warnTone !== 'bad') problems.push('meldingstoon ' + JSON.stringify([out['niet-synchroon'].warnTone, out.tegenstrijdig.warnTone]));
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
    // RC2: de burst-waarden sluiten niet met de (15 min oude) Alfen-meting ⇒ netroute gepauzeerd ⇒ grootte zonder teken
    assert.equal(r.value, '1,20 kW');
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- veroudering zonder nieuwe update stopt de lichtpunten
  await check('veroudering zonder nieuwe HA-update: P1 passeert de route-TTL (60 s) ⇒ netroute en lichtpunten stoppen via één timer', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering' });
    const r = await page.evaluate(async () => {
      const card = window.__ha.card, c = card.debug.cockpit, h = window.__ha.hass, id = 'sensor.p1_meter_vermogen';
      const t = new Date(Date.now() - 58500).toISOString();
      window.__ha.push({ ...h, states: { ...h.states, [id]: { ...h.states[id], state: '-1880', last_updated: t, last_changed: t } } });
      await new Promise(res => setTimeout(res, 200));
      const before = c.particleInfo().find(p => p.id === 'flow-net').active;
      await new Promise(res => setTimeout(res, 2200));
      const after = c.particleInfo().find(p => p.id === 'flow-net').active;
      return { before, after, sub: card.shadowRoot.querySelector('.tile[data-key="net"] .t-sub').textContent, timers: window.__live.timeouts.size };
    });
    await ctx.close();
    assert.equal(r.before, true); assert.equal(r.after, false); assert.match(r.sub, /Niet live · bevestigd 1 min geleden/);
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


  // ---------------------------------------------------------------- RC1-A: versheid voor actieve routes (browser)
  await check('RC1-A: actieve PV/Alfen 2/5/10/20/35 min niet bevestigd met recente P1 ⇒ geen zon-/laadlichtpunten, waarden "niet live", netroute blijft', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=zonneladen' });
    const out = {};
    for (const min of [2, 5, 10, 20, 35]) {
      out[min] = await page.evaluate(async ([min, S]) => {
        const h = window.__ha.hass, now = Date.now(), iso = s => new Date(now - s * 1000).toISOString();
        const mk = (id, v, ageS) => ({ entity_id: id, state: String(v), attributes: { unit_of_measurement: 'W' }, last_changed: iso(ageS), last_updated: iso(ageS), context: { id: 'sim' } });
        window.__ha.push({ ...h, states: { ...h.states, [S.net]: mk(S.net, -380, 2), [S.house]: mk(S.house, 1460, 2), [S.pv]: mk(S.pv, 4820, min * 60 - (min === 35 ? 2 : 0)), [S.ev]: mk(S.ev, 2980, min * 60 - (min === 35 ? 2 : 0)) } });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const sr = window.__ha.card.shadowRoot, c = window.__ha.card.debug.cockpit;
        return { particles: c.particleInfo().filter(p => p.active).map(p => p.route).sort(), pv: sr.querySelector('.tile[data-key="pv"] .t-sub').textContent, pvv: sr.querySelector('.tile[data-key="pv"] .t-value').textContent, cu: sr.querySelector('.tile[data-key="cupra"] .t-sub').textContent, status: sr.querySelector('.ehc-status').textContent, warn: sr.querySelector('.ehc-warn').hidden };
      }, [min, SIM.ID]);
    }
    await ctx.close();
    for (const [min, o] of Object.entries(out)) {
      assert.deepEqual(o.particles, ['home-grid'], min + ' min');
      assert.match(o.pvv, /^4,82\s?kW$/, min + ' min: ' + o.pvv); assert.match(o.pv, new RegExp('Niet live · bevestigd ' + (min === '35' ? 34 : min) + ' min'));   // 35 min − 2 s (zie boven) assert.match(o.cu, /Niet live/);
      assert.match(o.status, /3\/5 meetwaarden actueel · 2 vertraagd/); assert.equal(o.warn, true);
    }
    assert.deepEqual(errors, []);
    return Object.fromEntries(Object.entries(out).map(([k, o]) => [k + ' min', o.particles.join(',') + ' · ' + o.status]));
  });
  await check('RC1-A: PV passeert de route-TTL (90 s) zonder nieuwe HA-update ⇒ zonlichtpunten stoppen, waarde blijft als "niet live"', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=zonneladen' });
    const r = await page.evaluate(async S => {
      const h = window.__ha.hass, c = window.__ha.card.debug.cockpit, t = new Date(Date.now() - 88500).toISOString();
      window.__ha.push({ ...h, states: { ...h.states, [S.pv]: { ...h.states[S.pv], last_updated: t, last_changed: t } } });
      await new Promise(res => setTimeout(res, 200));
      const on = id => c.particleInfo().filter(p => p.active && p.route === id).length > 0;
      const before = on('sun-home');
      await new Promise(res => setTimeout(res, 2200));
      return { before, after: on('sun-home'), grid: on('home-grid'), sub: window.__ha.card.shadowRoot.querySelector('.tile[data-key="pv"] .t-sub').textContent };
    }, SIM.ID);
    await ctx.close();
    assert.equal(r.before, true); assert.equal(r.after, false); assert.equal(r.grid, true); assert.match(r.sub, /Niet live/);
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- RC1-B: asynchrone meetketen (browser)
  await check('RC1-B: updatevolgorde P1 → huis → PV met verschillende leeftijden ⇒ nooit onterecht "Controle nodig"; synchroon tegenstrijdig ⇒ wel', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=zonneladen' });
    const steps = await page.evaluate(async S => {
      const sr = window.__ha.card.shadowRoot, c = window.__ha.card.debug.cockpit;
      const mk = (id, v, ageS, now) => ({ entity_id: id, state: String(v), attributes: { unit_of_measurement: 'W' }, last_changed: new Date(now - ageS * 1000).toISOString(), last_updated: new Date(now - ageS * 1000).toISOString(), context: { id: 'sim' } });
      const snap = name => ({ name, status: sr.querySelector('.ehc-status').textContent, particles: c.particleInfo().filter(p => p.active).map(p => p.route).sort(), badge: sr.querySelector('.ehc-demo').dataset.state, net: sr.querySelector('.tile[data-key="net"] .t-sub').textContent });
      const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const out = [];
      const put = async (patch, name) => { const h = window.__ha.hass, now = Date.now(), st = { ...h.states }; for (const [k, v, a] of patch) st[S[k]] = mk(S[k], v, a, now); window.__ha.push({ ...h, states: st }); await frame(); out.push(snap(name)); };
      await put([['net', -380, 1], ['pv', 4820, 1], ['house', 1460, 1], ['ev', 2980, 1]], '1 synchroon, sluit');
      await put([['net', 1620, 0.5], ['house', 1460, 6]], '2 P1 sprong, huis 6 s ouder');
      await put([['house', 3460, 0.2]], '3 huis volgt');
      await put([['pv', 2800, 0.1], ['net', 1620, 25], ['house', 3460, 25]], '4 PV daalt, P1/huis 25 s oud');
      await put([['net', 3640, 0.3], ['house', 3460, 0.2]], '5 P1/huis volgen, sluit');
      await put([['house', 6000, 0.1], ['net', 3640, 0.2], ['pv', 2800, 0.2], ['ev', 2980, 0.2]], '6 synchroon tegenstrijdig');
      return out;
    }, SIM.ID);
    await ctx.close();
    const by = Object.fromEntries(steps.map(s => [s.name.slice(0, 1), s]));
    assert.match(by[1].status, /5\/5/); assert.deepEqual(by[1].particles, ['home-ev', 'home-grid', 'sun-home']);
    for (const k of ['2', '4']) { assert.equal(by[k].status, 'Meetketen niet synchroon', k); assert.deepEqual(by[k].particles, [], k); assert.equal(by[k].badge, 'degraded'); assert.equal(by[k].net, 'Richting niet bevestigd'); }
    for (const k of ['3', '5']) { assert.match(by[k].status, /5\/5/, k); assert.deepEqual(by[k].particles, ['grid-home', 'home-ev', 'sun-home'], k); }
    assert.equal(by[6].status, 'Controle nodig'); assert.deepEqual(by[6].particles, []);
    assert.ok(!steps.slice(0, 5).some(s => s.status === 'Controle nodig'));
    assert.deepEqual(errors, []);
    return steps.map(s => s.name + ' ⇒ ' + s.status + ' · ' + (s.particles.join(',') || '-'));
  });

  // ---------------------------------------------------------------- RC2: netpresentatie bij meetproblemen
  await check('RC2: niet-synchroon/tegenstrijdig ⇒ Net-kaart absoluut zonder teken/pijl; detailpaneel houdt ruwe ondertekende waarde, tijdstempel en tekenconfiguratie; herstel ⇒ normaal', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=niet-synchroon' });
    const r = await page.evaluate(async () => {
      const sr = window.__ha.card.shadowRoot, frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const tile = () => { const b = sr.querySelector('.ehm-tiles .tile[data-key="net"]'); return { value: b.querySelector('.t-value').textContent, sub: b.querySelector('.t-sub').textContent, dir: b.dataset.direction, extra: b.querySelector('.t-extra').hidden ? '' : b.querySelector('.t-extra').textContent, aria: b.getAttribute('aria-label'), plate: sr.querySelector('.ehm-plate[data-key="net"]').dataset.direction, accent: getComputedStyle(b.querySelector('.t-extra')).color }; };
      const detail = () => { const d = sr.querySelector('.ehc-detail'); const rows = {}; const dts = [...d.querySelectorAll('dt')]; dts.forEach(dt => { rows[dt.textContent] = dt.nextElementSibling.textContent; }); return { value: d.querySelector('.d-value').textContent, rows }; };
      const hold = tile();
      sr.querySelector('.ehm-tiles .tile[data-key="net"]').click(); await frame();
      const dHold = detail();
      window.__ha.set('teruglevering'); await frame(); await new Promise(res => setTimeout(res, 100));
      const back = tile(), dBack = detail();
      window.__ha.set('nul-watt'); await frame(); await new Promise(res => setTimeout(res, 100));
      const zero = tile();
      return { hold, dHold, back, dBack, zero };
    });
    await ctx.close();
    assert.match(r.hold.value, /^1,88\s?kW$/); assert.equal(r.hold.dir, 'unconfirmed'); assert.equal(r.hold.plate, 'unconfirmed'); assert.equal(r.hold.extra, 'P1-meting');
    assert.equal(r.hold.sub, 'Richting niet bevestigd');
    assert.equal(r.hold.aria, 'Net: 1,88 kW, P1-meting · richting niet bevestigd (meetketen niet synchroon). Details openen.');
    assert.equal(r.hold.accent, 'rgb(170, 180, 195)');
    assert.equal(r.dHold.value, '1,88 kW');
    assert.match(r.dHold.rows['Ruwe P1-sensorwaarde'], /^-1880 W \(zoals de bron meldt/);
    assert.match(r.dHold.rows['Tijdstempel'], /^last_updated · \d\d:\d\d:\d\d · zojuist — tijdstip van de HA-statusmelding, geen bewezen fysieke meettijd$/);
    assert.equal(r.dHold.rows['P1-tekenconfiguratie'], 'Import positief');
    assert.match(r.dHold.rows['Richting'], /Niet bevestigd/);
    assert.match(r.back.value, /^−1,88\s?kW$/); assert.equal(r.back.dir, 'export'); assert.equal(r.back.extra, '↓ naar net'); assert.equal(r.back.sub, 'Teruglevering aan het net');
    assert.equal(r.dBack.value, '−1,88 kW'); assert.match(r.dBack.rows['Richting'], /Teruglevering/);
    assert.match(r.zero.value, /^0\s?W$/); assert.equal(r.zero.dir, 'none'); assert.equal(r.zero.sub, 'In balans');
    assert.deepEqual(errors, []);
    return { hold: r.hold.value + ' · ' + r.hold.sub, raw: r.dHold.rows['Ruwe P1-sensorwaarde'], back: r.back.value };
  });

  await check('RC2: compacte mobiele weergave (390 px) ⇒ chip "P1 · richting onbevestigd", grootte zonder teken; list (320 px) ⇒ "P1-meting" + regel', async () => {
    const res = {};
    for (const [w, h] of [[390, 844], [320, 700]]) {
      const { ctx, page, errors } = await open(browser, base, { width: w, height: h, query: '?scenario=niet-synchroon', dpr: 2 });
      res[w] = await page.evaluate(() => { const sr = window.__ha.card.shadowRoot, b = sr.querySelector('.ehm-tiles .tile[data-key="net"]'), x = b.querySelector('.t-extra'); return { layout: sr.querySelector('.ehc').dataset.layout, value: b.querySelector('.t-value').textContent, extra: x.hidden ? '' : x.textContent, extraVisible: !x.hidden && getComputedStyle(x).display !== 'none', sub: b.querySelector('.t-sub').textContent, dir: b.dataset.direction }; });
      res[w].errors = errors; await ctx.close();
    }
    assert.equal(res[390].layout, 'compact'); assert.equal(res[390].extra, 'P1 · richting onbevestigd'); assert.equal(res[390].extraVisible, true);
    assert.equal(res[320].layout, 'list'); assert.equal(res[320].extra, 'P1-meting'); assert.equal(res[320].sub, 'Richting niet bevestigd');
    for (const r of Object.values(res)) { assert.match(r.value, /^1,88\s?kW$/); assert.equal(r.dir, 'unconfirmed'); assert.deepEqual(r.errors, []); }
    return res;
  });

  // ---------------------------------------------------------------- RC2: lifecycle van de beeldaanvraag
  await check('RC2: ontkoppelen tijdens een hangende resolve ⇒ geen time-out-timer, geen wachter, geen terugval; opnieuw koppelen ⇒ één nieuwe resolve en beeld', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering&resolve=hang&resolveTimeout=60000', waitScene: false });
    await page.waitForFunction(() => window.__ha.resolves === 1);
    const r = await page.evaluate(async () => {
      const card = window.__ha.card, parent = card.parentNode, sc = () => card.shadowRoot.querySelector('.ehc').dataset.scene;
      const before = { pending: card.debug.pendingResolve, scene: sc() };
      card.remove(); await new Promise(res => setTimeout(res, 300));
      const detached = { timeouts: window.__live.timeouts.size, rafs: window.__live.rafs.size, pending: card.debug.pendingResolve, waiters: card.debug.hassWaiters, scene: sc(), resolves: window.__ha.resolves };
      window.__ha.resolveMode = 'ok';
      parent.appendChild(card);
      for (let i = 0; i < 40 && sc() !== 'ok'; i++) await new Promise(res => setTimeout(res, 100));
      return { before, detached, after: { scene: sc(), resolves: window.__ha.resolves, pending: card.debug.pendingResolve } };
    });
    await ctx.close();
    assert.deepEqual(r.before, { pending: true, scene: 'loading' });
    assert.deepEqual(r.detached, { timeouts: 0, rafs: 0, pending: false, waiters: 0, scene: 'loading', resolves: 1 });
    assert.deepEqual(r.after, { scene: 'ok', resolves: 2, pending: false });
    assert.deepEqual(errors, []);
    return r;
  });
  await check('RC2: laat antwoord na ontkoppelen wordt genegeerd (geen beeldbron, geen /media-verzoek); 25× koppelen zonder hass ⇒ hooguit één wachter', async () => {
    log.length = 0;
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering&resolve=slow&slowMs=2500', waitScene: false });
    const r = await page.evaluate(async () => {
      const card = window.__ha.card, parent = card.parentNode, sr = card.shadowRoot;
      if (card.debug.cockpit.el.dataset.scene !== 'loading' || !card.debug.pendingResolve) return { precondition: 'resolve al afgerond vóór ontkoppelen' };
      card.remove();
      await new Promise(res => setTimeout(res, 2800));                 // het trage antwoord (2,5 s) komt binnen terwijl ontkoppeld
      const late = { src: sr.querySelector('.ehm-scene').getAttribute('src') || '', scene: sr.querySelector('.ehc').dataset.scene, pending: card.debug.pendingResolve };
      // kaart zonder hass: herhaald koppelen/ontkoppelen mag geen wachters of timers opstapelen
      const c = document.createElement('energiehuis-live-cockpit-preview');
      c.setConfig({ image: 'media-source://media_source/local/energiehuis/approved-visual-20261109.webp' });
      const box = document.createElement('div'); document.body.appendChild(box);
      let maxW = 0;
      for (let i = 0; i < 25; i++) { box.appendChild(c); await new Promise(res => setTimeout(res, 10)); maxW = Math.max(maxW, c.debug.hassWaiters); c.remove(); }
      await new Promise(res => setTimeout(res, 50));
      return { late, mediaWhileDetached: performance.getEntriesByType('resource').filter(e => /\/media\//.test(e.name)).length, maxW, endW: c.debug.hassWaiters, endPending: c.debug.pendingResolve, timeouts: window.__live.timeouts.size };
    });
    await ctx.close();
    assert.deepEqual(r.late, { src: '', scene: 'loading', pending: false });
    assert.equal(r.mediaWhileDetached, 0); assert.equal(log.filter(l => l.path.startsWith('/media/')).length, 0);
    assert.ok(r.maxW <= 1, 'wachters ' + r.maxW); assert.equal(r.endW, 0); assert.equal(r.endPending, false); assert.equal(r.timeouts, 0);
    assert.deepEqual(errors, []);
    return r;
  });

  // ---------------------------------------------------------------- RC1-C: offline ondubbelzinnig
  await check('RC1-C: verbinding weg ⇒ kop en pil rood OFFLINE (geen groene LIVE), "sinds HH:MM", geen waarden/lichtpunten; herstel ⇒ groen LIVE', async () => {
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=zonneladen' });
    const r = await page.evaluate(async () => {
      const sr = window.__ha.card.shadowRoot, c = window.__ha.card.debug.cockpit;
      const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const s = () => { const b = sr.querySelector('.ehc-demo'), p = sr.querySelector('.ehm-pill'); return { badge: b.textContent, bstate: b.dataset.state, bbg: getComputedStyle(b).backgroundColor, pill: p.textContent, pstate: p.dataset.state, pbg: getComputedStyle(p.querySelector('.p-demo')).backgroundColor, status: sr.querySelector('.ehc-status').textContent, particles: c.particleInfo().filter(x => x.active).length, net: sr.querySelector('.tile[data-key="net"] .t-value').textContent }; };
      const a = s();
      const h = window.__ha.hass; window.__ha.push({ ...h, connected: false }); await frame();
      const b = s();
      window.__ha.push({ ...h, connected: true }); await frame();
      return { live: a, offline: b, back: s() };
    });
    await ctx.close();
    const green = 'rgb(95, 231, 160)';
    assert.equal(r.live.bstate, 'live'); assert.equal(r.live.bbg, green);
    assert.equal(r.offline.bstate, 'offline'); assert.equal(r.offline.pstate, 'offline');
    assert.match(r.offline.badge, /^OFFLINE · geen verbinding/); assert.doesNotMatch(r.offline.badge + r.offline.pill, /LIVE/);
    assert.notEqual(r.offline.bbg, green); assert.notEqual(r.offline.pbg, green); assert.equal(r.offline.bbg, r.offline.pbg);
    assert.match(r.offline.pill, /OFFLINEgeen verbindingsinds \d\d:\d\d/);
    assert.equal(r.offline.status, 'Offline'); assert.equal(r.offline.particles, 0); assert.equal(r.offline.net, '—');
    assert.equal(r.back.bstate, 'live'); assert.equal(r.back.bbg, green); assert.ok(r.back.particles > 0);
    assert.deepEqual(errors, []);
    return { offline: r.offline.badge + ' | ' + r.offline.pill, bg: r.offline.bbg };
  });

  // ---------------------------------------------------------------- RC1-D: beveiligde master, terugval
  await check('RC1-D: mislukte, hangende, lege of onveilige resolve (/local/, extern) ⇒ veilige terugval, geen aanvraag buiten /media; data blijft werken', async () => {
    const res = {};
    for (const mode of ['fail', 'hang', 'empty', 'local', 'external']) {
      log.length = 0;
      const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering&resolve=' + mode + '&resolveTimeout=400', waitScene: false });
      await page.waitForFunction(() => window.__ha.card.shadowRoot.querySelector('.ehc').dataset.scene === 'error', null, { timeout: 5000 });
      const s = await page.evaluate(STATE);
      res[mode] = { scene: s.scene, layout: s.layout, note: s.note, img: s.imgSrc, resolves: await page.evaluate(() => window.__ha.resolves), local: log.filter(l => l.path.startsWith('/local/')).length, media: log.filter(l => l.path.startsWith('/media/')).length, routes: s.routes, errors };
      await ctx.close();
    }
    for (const [mode, v] of Object.entries(res)) {
      assert.equal(v.scene, 'error', mode); assert.equal(v.img, '', mode + ': geen beeldbron gezet'); assert.equal(v.local, 0); assert.equal(v.media, 0);
      assert.deepEqual(v.routes, ['home-grid', 'sun-home'], mode + ': data werkt');
      assert.deepEqual(v.errors, [], mode);
      assert.ok(v.resolves <= 2, mode + ' resolves ' + v.resolves);
    }
    assert.match(res.hang.note, /kon niet worden opgehaald/);
    return Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.note + ' · resolves ' + v.resolves]));
  });
  await check('RC1-D: handtekening verloopt NA het laden ⇒ beeld blijft staan zonder nieuwe aanvraag; mislukt beeld ⇒ herstel na herverbinding', async () => {
    log.length = 0;
    const { ctx, page, errors } = await open(browser, base, { query: '?scenario=teruglevering&signTtl=1' });
    await page.waitForTimeout(1500);                                        // handtekening nu verlopen
    const kept = await page.evaluate(async () => {
      const card = window.__ha.card, parent = card.parentNode, h = window.__ha.hass;
      card.remove(); await new Promise(r => setTimeout(r, 100)); parent.appendChild(card);
      window.__ha.push({ ...h, connected: false }); await new Promise(r => setTimeout(r, 100)); window.__ha.push({ ...h, connected: true });
      await new Promise(r => setTimeout(r, 400));
      return { scene: card.shadowRoot.querySelector('.ehc').dataset.scene, resolves: window.__ha.resolves };
    });
    const mediaAfter = log.filter(l => l.path.startsWith('/media/')).length;
    await ctx.close();
    const { ctx: c2, page: p2, errors: e2 } = await open(browser, base, { query: '?scenario=teruglevering&resolve=fail' });
    const rec = await p2.evaluate(async () => {
      const card = window.__ha.card, h = window.__ha.hass, sc = () => card.shadowRoot.querySelector('.ehc').dataset.scene;
      const a = sc(); window.__ha.resolveMode = 'ok';
      window.__ha.push({ ...h }); await new Promise(r => setTimeout(r, 300));
      const noReconnect = sc();                                             // zonder herverbinding: geen nieuwe poging
      window.__ha.push({ ...h, connected: false }); await new Promise(r => setTimeout(r, 100));
      window.__ha.push({ ...h, connected: true }); await new Promise(r => setTimeout(r, 1200));
      return { before: a, noReconnect, after: sc(), resolves: window.__ha.resolves, src: card.shadowRoot.querySelector('.ehm-scene').getAttribute('src') };
    });
    await c2.close();
    assert.equal(kept.scene, 'ok'); assert.equal(kept.resolves, 1); assert.equal(mediaAfter, 1);
    assert.equal(rec.before, 'error'); assert.equal(rec.noReconnect, 'error'); assert.equal(rec.after, 'ok'); assert.equal(rec.resolves, 2);
    assert.match(rec.src, /^http:\/\/127\.0\.0\.1:\d+\/media\/local\/energiehuis\/.+\?authSig=/);
    assert.deepEqual(errors.filter(e => !/40[13]|Failed to load resource/.test(e)), []); assert.deepEqual(e2, []);
    return { kept, recovered: rec };
  });

  // ---------------------------------------------------------------- screenshots
  if (WANT_SHOTS) {
    await check('screenshots LIVE (gesimuleerde HA): desktop en mobiel × teruglevering / zonneladen / afname / 0 W / offline / nacht / deels vertraagd / niet synchroon', async () => {
      const files = [];
      for (const [vp, w, h] of [['desktop', 1440, 900], ['mobiel', 390, 844]]) for (const sc of ['teruglevering', 'zonneladen', 'afname', 'nul-watt', 'offline', 'constant-nacht', 'deels-vertraagd', 'niet-synchroon']) {
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
