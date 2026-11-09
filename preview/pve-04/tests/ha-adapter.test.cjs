'use strict';
// PVE-04 HA-01 · datacontract, adapter en LIVE-modelgedrag met gesimuleerde Home Assistant-states.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../ha/contract.js');
const A = require('../ha/adapter.js');
const SIM = require('../ha/sim.js');
const M = require('../model.js');

const DIR = path.join(__dirname, '..');
const REPO = path.join(DIR, '..', '..');
const NOW = Date.parse('2026-11-09T20:00:00Z');
const run = (scenario, cfg) => { const sc = SIM.SCENARIOS[scenario]; const a = A.createAdapter(cfg || sc.config || {}); const h = SIM.createHass(scenario, NOW); return { a, h, m: M.computeModel(a.input(h, NOW)) }; };
const active = m => Object.entries(m.routes).filter(([, r]) => r.active).map(([k]) => k).sort();

test('contract hergebruikt exact de standaard-entiteiten en sleutels van de productiekaart', () => {
  const src = fs.readFileSync(path.join(REPO, 'src', 'legacy', '00-foundation.js'), 'utf8');
  const block = src.slice(src.indexOf('const EH_DEFAULTS'), src.indexOf('};', src.indexOf('const EH_DEFAULTS')));
  const def = k => { const m = new RegExp('\\n\\s*' + k + ":\\s*'([^']*)'").exec(block); return m ? m[1] : undefined; };
  for (const [key, s] of Object.entries(C.SOURCES)) {
    if (key === 'practice') { assert.equal(s.default, ''); continue; }
    assert.equal(def(s.config), s.default, key + ' → ' + s.config);
  }
});

test('configuratie: onbekende sleutels genegeerd, ongeldige ID/teken/beeld geweigerd, praktijk niet koppelbaar', () => {
  const ok = C.normalizeConfig({ type: 'custom:energiehuis-card', prijs: 'sensor.x', net: 'sensor.mijn_p1', water: '' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.entities.net, 'sensor.mijn_p1');
  assert.equal(ok.entities.pv, 'sensor.goodwe_pv_power');
  assert.equal(ok.p1Sign, 'import_positive');
  const bad = C.normalizeConfig({ net: 'SENSOR P1', p1_sign: 'negatief', image: 'https://evil.example/x.webp' });
  assert.equal(bad.errors.length, 3);
  for (const img of ['/local/x.webp', 'media-source://media_source/local/../secrets.webp', 'media-source://camera/x.jpg', 'media-source://media_source/local/x.gif'])
    assert.ok(C.normalizeConfig({ image: img }).errors.length, img);
  assert.deepEqual(C.normalizeConfig({ image: 'media-source://media_source/local/energiehuis/master.webp' }).errors, []);
  const pr = C.normalizeConfig({ praktijk: 'sensor.praktijk_vermogen' });
  assert.equal(pr.entities.practice, null); assert.match(pr.notes[0], /niet koppelbaar/);
});

test('scenario’s: routes, tegels en status volgen het contract (afname, teruglevering, zonneladen, 0 W, offline, unavailable)', () => {
  assert.deepEqual(active(run('afname').m), ['grid-home', 'home-ev', 'sun-home']);
  assert.deepEqual(active(run('teruglevering').m), ['home-grid', 'sun-home']);
  assert.deepEqual(active(run('zonneladen').m), ['home-ev', 'home-grid', 'sun-home']);
  for (const s of ['nul-watt', 'offline', 'unavailable', 'tegenstrijdig', 'p1-omgekeerd-fout']) assert.deepEqual(active(run(s).m), [], s);
  const off = run('offline').m; assert.equal(off.status.text, 'Offline'); assert.equal(off.tiles.net.value, '—');
  const un = run('unavailable').m; assert.equal(un.tiles.net.sub, 'Geen geldige waarde'); assert.equal(un.tiles.pv.value, '—');
  const z = run('nul-watt').m; assert.equal(z.tiles.net.value, '0 W'); assert.equal(z.grid.direction, 'balance');
});

test('eenheden: W en kW (ook komma), ongeldige of ontbrekende eenheid nooit als W aangenomen', () => {
  const k = run('kw').m;
  assert.equal(k.tiles.net.value, '−1,88 kW'); assert.equal(k.tiles.pv.value, '3,34 kW'); assert.equal(k.tiles.house.value, '1,46 kW');
  const e = run('eenheid-fout').m;
  assert.match(e.tiles.net.sub, /Onbekende eenheid “Wh”/); assert.match(e.tiles.pv.sub, /Eenheid ontbreekt/);
  assert.match(e.tiles.cupra.sub, /Onbekende eenheid “A”/); assert.equal(e.tiles.cupra.soc, '—');
  assert.deepEqual(active(e), []);
});

test('ontbrekende sensoren blijven zichtbaar ontbrekend (nooit 0)', () => {
  const { m } = run('ontbrekend');
  assert.equal(m.tiles.pv.value, '—'); assert.equal(m.tiles.pv.sub, 'Entiteit niet gevonden');
  assert.equal(m.tiles.cupra.value, '—'); assert.equal(m.tiles.battery.value, '—');
  assert.deepEqual(active(m), ['home-grid']);
});

test('versheid: bron-tijdstempel (last_reported ≥ last_updated), geen verzonnen tijd; verouderd/toekomst/geen tijd ⇒ niet actueel', () => {
  const v = run('verouderd').m;
  assert.equal(v.readings.net.state, 'stale'); assert.match(v.tiles.net.sub, /Verouderd · 20 min/); assert.deepEqual(active(v), ['sun-home']);
  const c = run('constant-gerapporteerd').m;
  assert.equal(c.readings.net.state, 'live'); assert.equal(c.readings.net.stampSource, 'last_reported'); assert.ok(c.readings.net.ageMs < 5000);
  // zelfde constante waarde ZONDER last_reported ⇒ verouderd (geen schijnactualiteit)
  const h = SIM.createHass('constant-gerapporteerd', NOW); const st = { ...h.states['sensor.p1_meter_vermogen'] }; delete st.last_reported;
  const a = A.createAdapter({}); const m2 = M.computeModel(a.input({ ...h, states: { ...h.states, 'sensor.p1_meter_vermogen': st } }, NOW));
  assert.equal(m2.readings.net.state, 'stale');
  // toekomst > 120 s en ontbrekende tijd
  const fut = { ...st, last_updated: new Date(NOW + 300000).toISOString(), last_changed: new Date(NOW + 300000).toISOString() };
  assert.equal(M.computeModel(a.input({ ...h, states: { ...h.states, 'sensor.p1_meter_vermogen': fut } }, NOW)).readings.net.reason, 'Tijdstempel onbekend');
  const none = { entity_id: st.entity_id, state: '-1880', attributes: { unit_of_measurement: 'W' } };
  assert.equal(M.computeModel(a.input({ ...h, states: { ...h.states, 'sensor.p1_meter_vermogen': none } }, NOW)).readings.net.reason, 'Tijdstempel onbekend');
  // de adapter geeft de ORIGINELE state-objecten door (geen aangepaste tijdstempels)
  const inp = a.input(h, NOW); assert.equal(inp.states.net, h.states['sensor.p1_meter_vermogen']);
});

test('langdurig constant: stabiele bronnen tonen "laatste stand", nooit actueel of als route', () => {
  const { m } = run('constant-nacht');
  assert.equal(m.tiles.pv.value, '0 W'); assert.match(m.tiles.pv.sub, /Laatste stand · 3 uur · niet recent bevestigd/); assert.equal(m.tiles.pv.tone, 'warn');
  assert.equal(m.tiles.cupra.value, '0 W'); assert.match(m.tiles.cupra.sub, /Laatste stand/);
  assert.equal(m.tiles.cupra.soc, '80 %'); assert.match(m.tiles.cupra.socReason, /Laatste stand · 4 uur/);
  assert.equal(m.readings.pv.state, 'stale');
  assert.deepEqual(active(m), ['grid-home']);
  // een NIET-stabiele bron (P1) toont bij veroudering geen laatste waarde
  assert.equal(run('verouderd').m.tiles.net.value, '—');
  // PV met > 30 W die veroudert ⇒ geen laatste stand (alleen stabiele 0 W)
  const h = SIM.createHass('teruglevering', NOW); const pv = { ...h.states['sensor.goodwe_pv_power'], last_updated: new Date(NOW - 7200000).toISOString(), last_changed: new Date(NOW - 7200000).toISOString() };
  const m3 = M.computeModel(A.createAdapter({}).input({ ...h, states: { ...h.states, 'sensor.goodwe_pv_power': pv } }, NOW));
  assert.equal(m3.tiles.pv.value, '—');
});

test('tegenstrijdige meetketen en omgekeerde P1: gecorrigeerd ⇒ teruglevering, niet gecorrigeerd ⇒ gestopt', () => {
  const t = run('tegenstrijdig').m; assert.equal(t.critical, true); assert.equal(t.status.text, 'Controle nodig');
  const r = run('p1-omgekeerd').m; assert.equal(r.p1Sign, 'export_positive'); assert.equal(r.grid.direction, 'export'); assert.deepEqual(active(r), ['home-grid', 'sun-home']);
  const f = run('p1-omgekeerd-fout').m; assert.equal(f.critical, true); assert.deepEqual(active(f), []);
});

test('praktijk standaard niet gekoppeld; virtuele batterij altijd simulatie zonder route; LIVE-tekst zonder DEMO', () => {
  const { m } = run('zonneladen', { praktijk: 'sensor.praktijk_vermogen' });
  assert.equal(m.tiles.practice.sub, 'Nog niet gekoppeld'); assert.equal(m.routes['home-practice'].active, false);
  assert.equal(m.tiles.battery.tone, 'sim'); assert.match(m.tiles.battery.sub, /Geen fysieke opslag/);
  assert.ok(!Object.keys(m.routes).some(k => /batter/.test(k)));
  assert.equal(m.live, true); assert.equal(m.demo, false);
  assert.doesNotMatch(m.status.text + m.summary + Object.values(m.routes).map(r => r.reason).join(' '), /DEMO|fictiev/);
});

test('adapter: wijzigingsdetectie op state-referenties en verbinding; eerstvolgende hercontrole op de TTL-grens', () => {
  const a = A.createAdapter({});
  const h1 = SIM.createHass('teruglevering', NOW);
  assert.equal(a.changed(h1), true);
  const h2 = SIM.createHass('teruglevering', NOW, h1);                // zelfde tijden ⇒ zelfde objecten
  assert.equal(h2.states['sensor.p1_meter_vermogen'], h1.states['sensor.p1_meter_vermogen']);
  assert.equal(a.changed(h2), false);
  assert.equal(a.changed({ ...h2, states: { ...h2.states, 'sensor.iets_anders': { state: '1' } } }), false);
  assert.equal(a.changed({ ...h2, connected: false }), true);
  const p1 = SIM.st(SIM.ID.net, -1880, 'W', NOW, { ageS: 295 });
  const h3 = { ...h2, states: { ...h2.states, [SIM.ID.net]: p1 } };
  const ms = a.nextCheckMs(h3, NOW);
  assert.ok(ms > 4000 && ms <= 5100, String(ms));
  assert.ok(a.nextCheckMs(h1, NOW) <= 60000);
});

test('veiligheid: geen servicecalls, REST, tokens, opslag of bediening in de HA-runtime; callWS alleen media_source/resolve_media', () => {
  const code = f => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of ['ha/contract.js', 'ha/adapter.js', 'ha/live-card.js', 'master.js', 'model.js']) {
    assert.doesNotMatch(code(f), /callService|\bfetch\s*\(|XMLHttpRequest|WebSocket\(|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|access_token|Authorization|auth\/sign_path|hass\.connection\.sendMessage|subscribeEvents|customCards/, f);
  }
  const live = code('ha/live-card.js');
  const calls = live.match(/callWS\(\{[^}]*\}/g) || [];
  assert.equal(calls.length, 1); assert.match(calls[0], /type: 'media_source\/resolve_media'/);
  assert.match(live, /customElements\.define\('energiehuis-live-cockpit-preview'/);
  assert.doesNotMatch(live, /define\('energiehuis-card'/);
});
