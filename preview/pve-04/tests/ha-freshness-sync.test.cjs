'use strict';
// PVE-04 HA-01 RC1 · regressietests dataversheid (RC1-A) en asynchrone meetketen (RC1-B), met gesimuleerde HA-states.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../ha/contract.js');
const A = require('../ha/adapter.js');
const SIM = require('../ha/sim.js');
const M = require('../model.js');

const REPO = path.join(__dirname, '..', '..', '..');
const NOW = Date.parse('2026-11-09T12:00:00Z');
const ID = SIM.ID;
const active = m => Object.entries(m.routes).filter(([, r]) => r.active).map(([k]) => k).sort();

/**
 * Bouwt een hass-object. vals: { net, pv, house, ev } in W; ages: { key: s } (bron-tijdstempel, standaard 2 s);
 * lr: { key: s } voor last_reported.
 */
function hass({ vals = {}, ages = {}, lr = {} } = {}, now = NOW) {
  const v = { net: -380, pv: 4820, house: 1460, ev: 2980, ...vals };            // zonneladen: sluit exact
  const states = {
    [ID.net]: SIM.st(ID.net, v.net, 'W', now, { ageS: ages.net ?? 2, lrAgeS: lr.net ?? null }),
    [ID.pv]: SIM.st(ID.pv, v.pv, 'W', now, { ageS: ages.pv ?? 2, lrAgeS: lr.pv ?? null }),
    [ID.house]: SIM.st(ID.house, v.house, 'W', now, { ageS: ages.house ?? 2, lrAgeS: lr.house ?? null }),
    [ID.ev]: SIM.st(ID.ev, v.ev, 'W', now, { ageS: ages.ev ?? 2, lrAgeS: lr.ev ?? null }),
    [ID.soc]: SIM.st(ID.soc, 58, '%', now, { ageS: 300 }),
    [ID.battery]: SIM.st(ID.battery, 72, '%', now, { ageS: 300 })
  };
  return { connected: true, states };
}
const model = (h, cfg = {}, now = NOW, prev) => M.computeModel(A.createAdapter(cfg).input(h, now), prev);

// ======================================================================= RC1-A: versheid voor actieve routes

test('RC1-A beleid: toon-TTL volgt de productiecode, route-TTL is apart en strenger', () => {
  const src = fs.readFileSync(path.join(REPO, 'src', 'legacy', '16-regisseur-cockpit.js'), 'utf8');
  const prod = {};
  for (const m of src.matchAll(/\{key:'(\w+)',name:'[^']*',id:c\.(\w+),type:'\w+',ttl:(\d+)/g)) prod[m[2]] = +m[3];
  // productie (minuten) — de bron van de toon-TTL
  assert.equal(prod.net, 5); assert.equal(prod.zonnepanelen, 35); assert.equal(prod.huis, 5); assert.equal(prod.laden, 35);
  for (const k of ['net', 'pv', 'house', 'ev']) {
    const s = C.SOURCES[k];
    assert.equal(s.ttlS, prod[s.config] * 60, k + ': toon-TTL = productie');
    assert.ok(s.routeTtlS < s.ttlS, k + ': route-TTL strenger dan toon-TTL');
    assert.ok(s.routeTtlS <= 90, k + ': conservatieve standaard (≤ 90 s)');
  }
  // de productie toont geen energiebalans en geen animatie op basis van de 35-min-grens
  assert.match(src, /Geen energiebalans/);
  const specs = A.createAdapter({}).specs;
  assert.deepEqual([specs.net.routeTtlS, specs.house.routeTtlS, specs.pv.routeTtlS, specs.ev.routeTtlS], [60, 60, 90, 90]);
});

test('RC1-A: actieve PV-meting 2/5/10/20/35 min niet bevestigd, P1 recent ⇒ geen zonroute, waarde zichtbaar als "niet live"', () => {
  const ref = model(hass());
  assert.deepEqual(active(ref), ['home-ev', 'home-grid', 'sun-home']);
  for (const min of [2, 5, 10, 20, 35]) {
    const m = model(hass({ ages: { pv: min * 60 } }));
    assert.equal(m.readings.pv.state, 'recent', min + ' min');
    assert.equal(m.routes['sun-home'].active, false, min + ' min: zonroute');
    assert.equal(m.tiles.pv.value, '4,82 kW', min + ' min: laatst bevestigde waarde zichtbaar');
    assert.equal(m.tiles.pv.tone, 'warn');
    assert.match(m.tiles.pv.sub, new RegExp('Niet live · bevestigd ' + min + ' min geleden'));
    assert.equal(m.critical, false, min + ' min: geen kritieke fout');
    assert.equal(m.routes['home-grid'].active, true, min + ' min: P1 bewijst teruglevering');
    assert.equal(m.balance, 'niet vergelijkbaar');
    assert.match(m.status.text, /4\/5 meetwaarden actueel · 1 vertraagd/);
    assert.doesNotMatch(m.summary, /zon levert/);
  }
  // net binnen de route-TTL (60 s < 90 s) ⇒ wel actief
  assert.equal(model(hass({ ages: { pv: 60 } })).routes['sun-home'].active, true);
  // voorbij de toon-TTL (36 min): niet-nul vermogen verdwijnt (geen "laatste stand" voor > 30 W)
  const old = model(hass({ ages: { pv: 36 * 60 } }));
  assert.equal(old.readings.pv.state, 'stale'); assert.equal(old.tiles.pv.value, '—'); assert.match(old.tiles.pv.sub, /Verouderd · 36 min/);
});

test('RC1-A: actieve Alfen-meting 2/5/10/20/35 min niet bevestigd ⇒ geen laadroute, geen "Laden", waarde als "niet live"', () => {
  for (const min of [2, 5, 10, 20, 35]) {
    const m = model(hass({ ages: { ev: min * 60 } }));
    assert.equal(m.routes['home-ev'].active, false, min + ' min');
    assert.equal(m.tiles.cupra.charging, false);
    assert.equal(m.tiles.cupra.value, '2,98 kW');
    assert.match(m.tiles.cupra.sub, /Niet live · bevestigd/);
    assert.doesNotMatch(m.tiles.cupra.sub, /^Laden/);
    assert.equal(m.critical, false);
    assert.deepEqual(active(m), ['home-grid', 'sun-home']);
  }
  const both = model(hass({ ages: { pv: 600, ev: 600 } }));
  assert.deepEqual(active(both), ['home-grid']);
  assert.equal(both.critical, false);
});

test('RC1-A: vertraagde PV die niet meer klopt met recente P1 ⇒ alle routes gepauzeerd, geen kritieke fout', () => {
  // zon is weggevallen; P1 en huis zijn actueel (afname), PV staat nog op de laatste 4,82 kW van 10 min geleden
  const m = model(hass({ vals: { net: 4440, house: 1460, ev: 2980, pv: 4820 }, ages: { pv: 600 } }));
  assert.equal(m.critical, false); assert.equal(m.hold, 'Gepauzeerd: meetketen niet synchroon');
  assert.deepEqual(active(m), []);
  assert.equal(m.tiles.net.direction, 'import');                  // model kent de P1-richting …
  assert.equal(m.routes['grid-home'].active, false);              // … maar toont geen bewegende route
  assert.match(m.balanceInfo, /niet live bevestigd: zon/);
});

test('RC1-A: vertraagde P1 ⇒ grootte zichtbaar zonder teken of richting, geen netroute', () => {
  const m = model(hass({ ages: { net: 120 } }));
  assert.equal(m.readings.net.state, 'recent');
  assert.equal(m.tiles.net.value, '380 W'); assert.equal(m.tiles.net.direction, null);
  assert.match(m.tiles.net.sub, /Niet live · bevestigd 2 min geleden/);
  assert.equal(m.routes['home-grid'].active, false); assert.equal(m.routes['grid-home'].active, false);
  // constante P1 die wel recent is GERAPPORTEERD (last_reported) blijft live
  assert.equal(model(hass({ ages: { net: 7200 }, lr: { net: 3 } })).readings.net.state, 'live');
});

test('RC1-A: route-TTL per bron configureerbaar en gevalideerd', () => {
  const cfg = { route_ttl_s: { zonnepanelen: 600, laden: 30 } };
  assert.deepEqual(C.normalizeConfig(cfg).errors, []);
  assert.equal(model(hass({ ages: { pv: 300 } }), cfg).routes['sun-home'].active, true);
  assert.equal(model(hass({ ages: { pv: 601 } }), cfg).routes['sun-home'].active, false);
  assert.equal(model(hass({ ages: { ev: 45 } }), cfg).routes['home-ev'].active, false);
  for (const bad of [{ route_ttl_s: { zonnepanelen: 4 } }, { route_ttl_s: { zonnepanelen: 2101 } }, { route_ttl_s: { net: 301 } }, { route_ttl_s: { zonnepanelen: '90' } },
    { route_ttl_s: { cupra: 60 } }, { route_ttl_s: [60] }, { route_ttl_s: null }, { balance_max_skew_s: 0 }, { balance_max_skew_s: 121 }, { balance_max_skew_s: '10' }])
    assert.ok(C.normalizeConfig(bad).errors.length === 1, JSON.stringify(bad));
});

test('RC1-A: adapter plant een hercontrole op de route-TTL-grens (lichtpunten stoppen zonder nieuwe HA-update)', () => {
  const a = A.createAdapter({});
  const ms = a.nextCheckMs(hass({ ages: { pv: 85 } }), NOW);
  assert.ok(ms > 4000 && ms <= 5100, String(ms));
  const ms2 = a.nextCheckMs(hass({ ages: { net: 55 } }), NOW);
  assert.ok(ms2 > 4000 && ms2 <= 5100, String(ms2));
  assert.equal(a.describe(hass()).find(d => d.key === 'pv').routeTtlS, 90);
});

// ======================================================================= RC1-B: asynchrone meetketen

const contra = { net: -1880, pv: 3340, house: 3900, ev: 0 };    // net + zon − Cupra = 1460 ≠ 3900

test('RC1-B: synchroon gemeten tegenstrijdige keten ⇒ kritiek (bestaande fail-safe)', () => {
  for (const ages of [{}, { net: 1, pv: 9, house: 1, ev: 5 }, { net: 30, pv: 30, house: 30, ev: 30 }]) {
    const m = model(hass({ vals: contra, ages }));
    assert.equal(m.critical, true, JSON.stringify(ages)); assert.equal(m.balance, 'wijkt af');
    assert.deepEqual(active(m), []); assert.equal(m.status.text, 'Controle nodig');
  }
});

test('RC1-B: zelfde afwijking met uiteenlopende tijdstempels ⇒ "niet vergelijkbaar", routes gepauzeerd, NIET kritiek', () => {
  for (const ages of [{ pv: 30 }, { ev: 50, net: 1 }, { net: 45 }, { pv: 85, ev: 1, net: 1, house: 1 }]) {
    const m = model(hass({ vals: contra, ages }));
    assert.equal(m.critical, false, JSON.stringify(ages)); assert.equal(m.balance, 'niet vergelijkbaar');
    assert.equal(m.hold, 'Gepauzeerd: meetketen niet synchroon'); assert.deepEqual(active(m), []);
    assert.equal(m.status.text, 'Meetketen niet synchroon'); assert.equal(m.status.tone, 'warn');
    assert.ok(m.warnings.some(w => w.code === 'chain-async' && !w.critical));
    assert.ok(!m.warnings.some(w => w.critical));
    assert.match(m.summary, /gepauzeerd/);
  }
});

test('RC1-B: grens van de spreiding (10 s standaard, instelbaar)', () => {
  assert.equal(model(hass({ vals: contra, ages: { pv: 12, net: 2, house: 2, ev: 2 } })).critical, true);       // 10 s
  assert.equal(model(hass({ vals: contra, ages: { pv: 12.5, net: 2, house: 2, ev: 2 } })).critical, false);   // 10,5 s
  const cfg = { balance_max_skew_s: 30 };
  assert.equal(model(hass({ vals: contra, ages: { pv: 30, net: 2, house: 2, ev: 2 } }), cfg).critical, true);
  assert.equal(model(hass({ vals: contra, ages: { pv: 33, net: 2, house: 2, ev: 2 } }), cfg).critical, false);
});

test('RC1-B: updatevolgorde — P1 sprong vóór de huissensor ⇒ eerst "in afwachting", na huisupdate weer sluitend', () => {
  const a = A.createAdapter({});
  // 1. synchroon en sluitend
  let t = NOW, m = M.computeModel(a.input(hass({}, t), t));
  assert.equal(m.balance, 'sluit'); assert.deepEqual(active(m), ['home-ev', 'home-grid', 'sun-home']);
  // 2. waterkoker aan: P1 meldt 2 kW meer afname (1 s oud), huissensor nog de oude waarde (5 s oud)
  t += 1000;
  m = M.computeModel(a.input(hass({ vals: { net: 1620 }, ages: { net: 1, house: 5 } }, t), t), m);
  assert.equal(m.critical, false, 'geen onterechte kritieke fout');
  assert.equal(m.balance, 'niet vergelijkbaar'); assert.deepEqual(active(m), []);
  assert.match(m.balanceInfo, /huissensor loopt 4 s achter/);
  // 3. huissensor volgt (0,5 s oud) ⇒ sluit weer, routes terug, netrichting nu afname
  t += 500;
  m = M.computeModel(a.input(hass({ vals: { net: 1620, house: 3460 }, ages: { net: 1.5, house: 0.5 } }, t), t), m);
  assert.equal(m.balance, 'sluit'); assert.equal(m.critical, false);
  assert.deepEqual(active(m), ['grid-home', 'home-ev', 'sun-home']);
});

test('RC1-B: updatevolgorde — huissensor NA de invoer bijgewerkt en toch tegenstrijdig ⇒ kritiek', () => {
  const m = model(hass({ vals: contra, ages: { net: 4, pv: 6, ev: 5, house: 1 } }));
  assert.equal(m.critical, true); assert.equal(m.balance, 'wijkt af');
  // huis 1,5 s achter (binnen de marge van 2 s) blijft synchroon
  assert.equal(model(hass({ vals: contra, ages: { net: 1, pv: 1, ev: 1, house: 2.5 } })).critical, true);
  // huis 3 s achter ⇒ niet aantoonbaar
  assert.equal(model(hass({ vals: contra, ages: { net: 1, pv: 1, ev: 1, house: 4 } })).critical, false);
});

test('RC1-B: sluitende waarden maar uiteenlopende tijden ⇒ geen bevestiging, wel routes (elke route rust op een eigen actuele meter)', () => {
  const m = model(hass({ ages: { pv: 40 } }));
  assert.equal(m.balance, 'niet vergelijkbaar'); assert.equal(m.hold, null); assert.equal(m.critical, false);
  assert.deepEqual(active(m), ['home-ev', 'home-grid', 'sun-home']);
  assert.deepEqual(m.warnings, []);
  assert.match(m.balanceInfo, /niet als bevestiging/);
});

test('RC1-B: last_reported telt mee voor de spreiding; negatieve huissensor blijft altijd kritiek', () => {
  // constante waarden, last_updated oud maar last_reported recent ⇒ synchroon ⇒ tegenstrijdigheid is kritiek
  const m = model(hass({ vals: contra, ages: { net: 3600, pv: 3600, house: 3600, ev: 3600 }, lr: { net: 1, pv: 2, house: 1, ev: 2 } }));
  assert.equal(m.critical, true);
  const n = model(hass({ vals: { house: -350 }, ages: { pv: 40 } }));
  assert.equal(n.critical, true); assert.ok(n.warnings.some(w => w.code === 'house-negative'));
});

test('RC1-B: willekeurige leeftijden en volgordes — kritiek ALLEEN bij een synchrone keten, nooit een route bij een niet-synchrone afwijking', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let crit = 0, held = 0;
  for (let i = 0; i < 400; i++) {
    const sc = i % 2 ? 14 : 110;                                  // afwisselend bijna-synchroon en sterk uiteenlopend
    const ages = { net: rnd() * sc, pv: rnd() * sc, house: rnd() * sc, ev: rnd() * sc };
    const vals = rnd() < 0.5 ? contra : {};
    const m = model(hass({ vals, ages }));
    const live = ['net', 'pv', 'house', 'ev'].every(k => ['live', 'live-zero'].includes(m.readings[k].state));
    const t = ['net', 'pv', 'house', 'ev'].map(k => NOW - Math.round(ages[k] * 1000));
    const skew = Math.max(...t) - Math.min(...t), lag = Math.max(t[0], t[1], t[3]) - t[2];
    if (m.critical) { crit++; assert.ok(live && skew <= 10000 && lag <= 2000, JSON.stringify(ages)); }
    if (m.balance === 'niet vergelijkbaar' && vals === contra) { held++; assert.deepEqual(active(m), [], JSON.stringify(ages)); }
  }
  assert.ok(crit > 0 && held > 0, `${crit} kritiek, ${held} gepauzeerd`);
});

test('DEMO ongewijzigd: geen route-TTL-wijziging zonder HA-specs, scenario-uitkomsten gelijk', () => {
  for (const id of M.SCENARIO_IDS) {
    const m = M.computeModel(M.scenarioInput(id, NOW));
    assert.ok(!Object.values(m.readings).some(r => r.state === 'recent'), id);
  }
  assert.equal(M.computeModel(M.scenarioInput('p1-fout', NOW)).critical, true);
  assert.equal(M.computeModel(M.scenarioInput('huis-negatief', NOW)).critical, true);
});

test('geen fictieve meetgegevens in de LIVE-runtime: kaart, adapter en contract kennen sim.js en DEMO-scenario’s niet', () => {
  const code = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of ['ha/live-card.js', 'ha/adapter.js', 'ha/contract.js'])
    assert.doesNotMatch(code(f), /EhHaSim|sim\.js|SCENARIOS|scenarioInput|jitter|simulated\s*:\s*true/, f);
  // de adapter geeft altijd live: true en uitsluitend de hass-states door
  const inp = A.createAdapter({}).input({ connected: true, states: {} }, NOW);
  assert.equal(inp.live, true);
  assert.ok(Object.values(inp.states).every(s => s.missing === true));
});
