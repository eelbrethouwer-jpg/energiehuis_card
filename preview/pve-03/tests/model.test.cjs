'use strict';
// PVE-03 · scenario- en veiligheidsinvarianten van het DEMO-model.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');

const NOW = Date.parse('2026-11-09T17:30:00Z');
const run = (id, tick = 0, prev = null) => M.computeModel(M.scenarioInput(id, NOW, tick), prev);
const active = m => Object.values(m.routes).filter(r => r.active).map(r => r.id).sort();

test('alle scenario’s rekenen en leveren alleen bekende routes; batterij is nooit een route', () => {
  assert.ok(M.SCENARIO_IDS.length >= 10);
  for (const id of M.SCENARIO_IDS) {
    const m = run(id);
    assert.equal(m.demo, true, id);
    assert.deepEqual(Object.keys(m.routes).sort(), [...M.ROUTES].sort(), id);
    assert.ok(!Object.keys(m.routes).some(k => /batter/i.test(k)), id);
    assert.equal(m.tiles.battery.tone, 'sim');
    assert.match(m.tiles.battery.sub, /geen fysieke opslag/i);
    for (const r of Object.values(m.routes)) {
      if (r.active) { assert.ok(Number.isFinite(r.watts) && r.watts >= M.T.routeMinW, id + ' ' + r.id); assert.ok(r.intensity > 0 && r.intensity <= 1); }
      else { assert.equal(r.watts, null); assert.equal(r.intensity, 0); }
    }
  }
});

test('normale scenario’s sluiten rekenkundig; dat wordt niet als verificatie gepresenteerd', () => {
  for (const id of ['zon-export', 'net-laden', 'zon-huis', 'nacht', 'p1-omgekeerd', 'praktijk-sim', 'grote-waarden']) {
    assert.equal(run(id).balance, 'sluit', id);
  }
  assert.ok(!('verified' in run('zon-export')), 'geen verificatievlag in het model');
});

test('zon & teruglevering: zon→huis, huis→net en huis→Cupra actief', () => {
  const m = run('zon-export');
  assert.deepEqual(active(m), ['home-ev', 'home-grid', 'sun-home']);
  assert.equal(m.grid.direction, 'export');
  assert.equal(m.tiles.net.value, '\u22121,88 kW');
  assert.equal(m.tiles.net.sub, 'Teruglevering aan het net');
  assert.equal(m.tiles.pv.value, '4,82 kW');
});

test('netafname & laden en nacht', () => {
  assert.deepEqual(active(run('net-laden')), ['grid-home', 'home-ev', 'sun-home']);
  const n = run('nacht');
  assert.deepEqual(active(n), ['grid-home']);
  assert.equal(n.tiles.pv.value, '0 W');
  assert.equal(n.tiles.pv.sub, 'Geen opwek');
});

test('offline: geen enkele actieve route en geen waarden', () => {
  const m = run('offline');
  assert.deepEqual(active(m), []);
  assert.equal(m.status.text, 'Offline');
  for (const k of ['pv', 'house', 'net', 'cupra']) assert.equal(m.tiles[k].value, '—', k);
  assert.ok(Object.values(m.routes).every(r => r.reason === 'Offline'));
});

test('verouderde P1: netroutes direct uit, overige blijven', () => {
  const m = run('verouderd');
  assert.equal(m.routes['grid-home'].active, false);
  assert.equal(m.routes['home-grid'].active, false);
  assert.equal(m.tiles.net.value, '—');
  assert.match(m.tiles.net.sub, /Verouderd/);
  assert.equal(m.routes['sun-home'].active, true);
});

test('onbekende eenheid: zon-route uit en geen getal', () => {
  const m = run('onbekende-eenheid');
  assert.equal(m.routes['sun-home'].active, false);
  assert.equal(m.tiles.pv.value, '—');
  assert.match(m.tiles.pv.sub, /Onbekende eenheid “Wh”/);
});

test('P1-tekenomkering: gecorrigeerd via configuratie, of gestopt bij foute configuratie', () => {
  const ok = run('p1-omgekeerd');
  assert.equal(ok.p1Sign, 'export_positive');
  assert.equal(ok.grid.direction, 'export');
  assert.equal(ok.routes['home-grid'].active, true);
  const bad = run('p1-fout');
  assert.equal(bad.critical, true);
  assert.equal(bad.balance, 'wijkt af');
  assert.deepEqual(active(bad), []);
  assert.equal(bad.status.text, 'Controle nodig');
});

test('negatieve huissensor: kritiek, geen routes, geen negatieve waarde getoond', () => {
  const m = run('huis-negatief');
  assert.equal(m.critical, true);
  assert.deepEqual(active(m), []);
  assert.equal(m.tiles.house.value, '—');
  assert.equal(m.tiles.house.tone, 'bad');
});

test('praktijk: standaard “Nog niet gekoppeld” zonder kW; alleen expliciete simulatie, nooit opgeteld bij huis', () => {
  for (const id of M.SCENARIO_IDS.filter(i => i !== 'praktijk-sim')) {
    const m = run(id);
    assert.equal(m.tiles.practice.value, '—', id);
    assert.equal(m.tiles.practice.sub, 'Nog niet gekoppeld', id);
    assert.equal(m.routes['home-practice'].active, false, id);
  }
  const s = run('praktijk-sim');
  assert.equal(s.routes['home-practice'].active, true);
  assert.equal(s.routes['home-practice'].simulated, true);
  assert.match(s.tiles.practice.sub, /SIMULATIE/);
  // huis toont exact de huissensor, zonder de gesimuleerde praktijk erbij
  assert.equal(s.tiles.house.value, M.formatPower(2110));
});

test('geen grace-periode: een actieve route wordt bij een ongeldige update direct inactief', () => {
  const before = run('zon-export');
  assert.equal(before.routes['home-grid'].active, true);
  const input = M.scenarioInput('zon-export', NOW);
  input.states.net = { state: 'unavailable', attributes: { unit_of_measurement: 'W' }, last_updated: new Date(NOW).toISOString() };
  const after = M.computeModel(input, before);
  assert.equal(after.routes['home-grid'].active, false);
  assert.equal(after.routes['grid-home'].active, false);
  assert.ok(!Object.values(after.routes).some(r => 'grace' in r));
  // ook bij een te oude tijdstempel
  const stale = M.scenarioInput('zon-export', NOW);
  stale.states.pv.last_updated = new Date(NOW - 10 * 60000).toISOString();
  assert.equal(M.computeModel(stale, before).routes['sun-home'].active, false);
});

test('netrichting: dode band claimt nooit de tegengestelde richting', () => {
  assert.equal(M.gridDirection(null, 'import'), null);
  assert.equal(M.gridDirection(30, 'import'), 'balance');
  assert.equal(M.gridDirection(60, 'import'), 'import');
  assert.equal(M.gridDirection(60, 'export'), 'balance');
  assert.equal(M.gridDirection(-60, 'export'), 'export');
  assert.equal(M.gridDirection(-60, 'import'), 'balance');
  assert.equal(M.gridDirection(80, null), 'import');
  assert.equal(M.gridDirection(-80, null), 'export');
});

test('readEntity: eenheden, ongeldige waarden en toekomstige tijdstempels', () => {
  const spec = M.SPECS.pv, iso = new Date(NOW).toISOString();
  assert.equal(M.readEntity({ state: '1,5', attributes: { unit_of_measurement: 'kW' }, last_updated: iso }, spec, NOW).value, 1500);
  assert.equal(M.readEntity({ state: 'unknown', attributes: { unit_of_measurement: 'W' }, last_updated: iso }, spec, NOW).state, 'unknown');
  assert.equal(M.readEntity({ state: '12', attributes: {}, last_updated: iso }, spec, NOW).state, 'invalid-unit');
  assert.equal(M.readEntity({ state: '12', attributes: { unit_of_measurement: 'W' }, last_updated: new Date(NOW + 3600e3).toISOString() }, spec, NOW).state, 'stale');
  assert.equal(M.readEntity(undefined, M.SPECS.practice, NOW).state, 'unlinked');
  assert.equal(M.readEntity({ state: '120', attributes: { unit_of_measurement: '%' }, last_updated: iso }, M.SPECS.soc, NOW).state, 'unknown');
});

test('formatPower: NL-notatie, duizendtallen, nooit een minteken', () => {
  assert.equal(M.formatPower(NaN), '—');
  assert.equal(M.formatPower(0), '0 W');
  assert.equal(M.formatPower(29), '0 W');
  assert.equal(M.formatPower(484), '480 W');
  assert.equal(M.formatPower(-1880), '1,88 kW');
  assert.equal(M.formatPower(1000), '1,00 kW');
  assert.equal(M.formatPower(12345), '12,3 kW');
  assert.equal(M.formatPower(-25000), '25,0 kW');
});

test('50 schommel-updates: balans blijft sluiten, routes blijven stabiel (geen flikkering)', () => {
  let prev = null;
  const base = active(run('zon-export'));
  for (let t = 1; t <= 50; t++) {
    const m = run('zon-export', t, prev);
    assert.equal(m.balance, 'sluit', 'tick ' + t);
    assert.deepEqual(active(m), base, 'tick ' + t);
    prev = m;
  }
});

test('lange labels en grote waarden blijven tekst (geen afkapping in het model)', () => {
  const m = run('grote-waarden');
  assert.equal(m.tiles.pv.value, '12,3 kW');
  assert.equal(m.tiles.net.value, '\u22129,87 kW');
  assert.ok(m.tiles.cupra.sub.length > 60);
  assert.equal(m.tiles.cupra.soc, '100 %');
});

// ---------------------------------------------------------------- reviewcorrecties (ChatGPT, b0322af)
const withEv = (state, label = 'Laden') => {
  const input = M.scenarioInput('zon-export', NOW);
  input.states.ev = { state: String(state), attributes: { unit_of_measurement: 'W' }, last_updated: new Date(NOW - 2000).toISOString() };
  input.cupra = { label };
  return M.computeModel(input);
};

test('negatieve EV-meting: nooit als positief vermogen of actieve laadsessie', () => {
  for (const v of [-1480, -31, -7400]) {
    const m = withEv(v);
    assert.equal(m.routes['home-ev'].active, false, v);
    assert.equal(m.routes['home-ev'].watts, null, v);
    assert.equal(m.tiles.cupra.value, '—', v);
    assert.equal(m.tiles.cupra.charging, false, v);
    assert.match(m.tiles.cupra.sub, /Ongeldige laadmeting \(negatief\)/, v);
    assert.doesNotMatch(m.tiles.cupra.sub, /^Laden/, v);
    assert.equal(m.tiles.cupra.tone, 'bad');
    assert.equal(m.balance, 'onbekend', 'ongeldige EV telt niet mee in de balans');
    assert.doesNotMatch(m.summary, /Cupra laadt/);
  }
  const sc = run('ev-negatief');
  assert.equal(sc.routes['home-ev'].active, false);
  assert.ok(sc.warnings.some(w => w.code === 'ev-invalid'));
});

test('EV binnen de nulband (−29…29 W) is 0 W en niet laden; onwaarschijnlijk hoog is ongeldig', () => {
  for (const v of [-29, -1, 0, 12]) {
    const m = withEv(v);
    assert.equal(m.tiles.cupra.value, '0 W', v);
    assert.equal(m.routes['home-ev'].active, false, v);
    assert.equal(m.tiles.cupra.sub, 'Niet aan het laden', 'fixture-label “Laden” mag niet zonder laadvermogen');
  }
  const hi = withEv(25000);
  assert.equal(hi.routes['home-ev'].active, false);
  assert.equal(hi.tiles.cupra.value, '—');
  assert.match(hi.tiles.cupra.sub, /te hoog/);
});

test('ongeldige EV-waarden (unavailable, kWh, verouderd) geven geen laadsessie', () => {
  const base = M.scenarioInput('zon-export', NOW);
  for (const st of [
    { state: 'unavailable', attributes: { unit_of_measurement: 'W' }, last_updated: new Date(NOW).toISOString() },
    { state: '1480', attributes: { unit_of_measurement: 'kWh' }, last_updated: new Date(NOW).toISOString() },
    { state: '1480', attributes: { unit_of_measurement: 'W' }, last_updated: new Date(NOW - 5 * 60000).toISOString() }
  ]) {
    const input = { ...base, states: { ...base.states, ev: st } };
    const m = M.computeModel(input);
    assert.equal(m.routes['home-ev'].active, false, st.state);
    assert.equal(m.tiles.cupra.value, '—');
    assert.equal(m.tiles.cupra.charging, false);
  }
});

test('net: teruglevering met minteken (U+2212) én richtingstekst; afname zonder teken; balans 0 W', () => {
  assert.equal(M.formatNet(-1880, 'export'), '−1,88 kW');
  assert.equal(M.formatNet(7600, 'import'), '7,60 kW');
  assert.equal(M.formatNet(20, 'balance'), '0 W');
  assert.equal(M.formatNet(NaN, null), '—');
  const e = run('zon-export'), i = run('net-laden'), c = run('p1-omgekeerd');
  assert.ok(e.tiles.net.value.startsWith('−')); assert.match(e.tiles.net.sub, /Teruglevering/);
  assert.ok(!i.tiles.net.value.startsWith('−')); assert.match(i.tiles.net.sub, /Afname/);
  assert.equal(c.tiles.net.value, '−1,88 kW', 'gecorrigeerde P1 toont ook export met minteken');
  // fout geconfigureerde P1: geen routes, ook al toont de tegel de (foute) richting
  assert.equal(run('p1-fout').routes['home-grid'].active, false);
});

test('toekomstige brontijdstempels: tot 120 s geaccepteerd, daarboven verouderd en nooit actief', () => {
  const spec = M.SPECS.pv, mk = s => ({ state: '4820', attributes: { unit_of_measurement: 'W' }, last_updated: new Date(NOW + s * 1000).toISOString() });
  assert.equal(M.T.futureToleranceMs, 120000);
  assert.equal(M.readEntity(mk(60), spec, NOW).state, 'live');
  assert.equal(M.readEntity(mk(119), spec, NOW).state, 'live');
  assert.equal(M.readEntity(mk(121), spec, NOW).state, 'stale');
  const input = M.scenarioInput('zon-export', NOW); input.states.pv = mk(3600);
  assert.equal(M.computeModel(input).routes['sun-home'].active, false);
  assert.ok(!Object.keys(M).some(k => /verif/i.test(k)), 'geen live-verificatievlaggen');
});

test('scenario-overgangen: geen route blijft hangen bij wissel naar offline/stale/negatief', () => {
  let prev = run('zon-export');
  for (const id of ['offline', 'verouderd', 'ev-negatief', 'huis-negatief', 'p1-fout', 'nacht', 'zon-export']) {
    const m = M.computeModel(M.scenarioInput(id, NOW), prev);
    const expected = M.computeModel(M.scenarioInput(id, NOW));
    assert.deepEqual(active(m), active(expected), id + ' na ' + (prev && Object.keys(prev.routes).join()));
    prev = m;
  }
});
