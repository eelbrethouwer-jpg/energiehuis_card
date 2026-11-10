'use strict';
// PVE-04 HA-01 RC2 · netpresentatie bij meetproblemen en voorlopig actualiteits-/synchronisatiebeleid.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../ha/contract.js');
const A = require('../ha/adapter.js');
const SIM = require('../ha/sim.js');
const M = require('../model.js');

const NOW = Date.parse('2026-11-09T20:00:00Z');
const ID = SIM.ID;
const run = (scenario, cfg, patch) => {
  const a = A.createAdapter(cfg || SIM.SCENARIOS[scenario].config || {});
  const h = SIM.createHass(scenario, NOW);
  const states = patch ? { ...h.states, ...patch(h) } : h.states;
  return M.computeModel(a.input({ ...h, states }, NOW));
};
const freshEv = () => ({ [ID.ev]: SIM.st(ID.ev, 0, 'W', NOW) });

// ======================================================================= 1. Netrichting tijdens meetproblemen

test('RC2 synchrone tegenstrijdigheid: Net-kaart absoluut, zonder teken of pijl, label "P1-meting · richting niet bevestigd"', () => {
  const m = run('tegenstrijdig');
  assert.equal(m.critical, true);
  const p = M.netPresentation(m);
  assert.equal(p.value, '1,88 kW'); assert.doesNotMatch(p.value, /[−-]/);
  assert.equal(p.direction, 'unconfirmed'); assert.equal(p.confirmed, false); assert.equal(p.unconfirmed, true);
  assert.equal(p.badge, 'P1-meting'); assert.equal(p.badgeCompact, 'P1 · richting onbevestigd'); assert.equal(p.sub, 'Richting niet bevestigd');
  assert.equal(p.label, 'P1-meting · richting niet bevestigd (meetketen tegenstrijdig)');
  // onderliggende waarden en P1-berekening ongewijzigd; ruwe ondertekende tekst blijft voor diagnose
  assert.equal(m.grid.importW, -1880); assert.equal(m.grid.direction, 'export');
  assert.equal(m.tiles.net.value, '−1,88 kW');
  assert.deepEqual({ ...m.readings.net.raw }, { state: '-1880', unit: 'W' });
  assert.equal(m.readings.net.stampSource, 'last_updated'); assert.ok(Number.isFinite(m.readings.net.stampMs));
  assert.equal(m.p1Sign, 'import_positive');
});

test('RC2 asynchrone keten: zelfde neutrale presentatie, reden "meetketen niet synchroon"', () => {
  const m = run('niet-synchroon');
  assert.equal(m.critical, false); assert.ok(m.hold);
  const p = M.netPresentation(m);
  assert.equal(p.value, '1,88 kW'); assert.equal(p.direction, 'unconfirmed');
  assert.equal(p.label, 'P1-meting · richting niet bevestigd (meetketen niet synchroon)');
  assert.equal(m.grid.importW, -1880);
  // omgekeerde P1 (niet gecorrigeerd, Alfen 15 min oud): ruwe positieve tekst blijft zichtbaar, kaart zonder teken
  const r = run('p1-omgekeerd-fout');
  assert.ok(r.hold); assert.equal(M.netPresentation(r).value, '1,88 kW'); assert.equal(r.readings.net.raw.state, '1880');
  // gecorrigeerde tekenconfiguratie bij een niet-synchrone afwijking: ruwe "1880", berekend −1880, kaart neutraal
  const g = run('p1-omgekeerd', { p1_sign: 'export_positive' }, h => ({ [ID.house]: SIM.st(ID.house, 3900, 'W', NOW), [ID.pv]: SIM.st(ID.pv, 3340, 'W', NOW, { ageS: 32 }), ...freshEv() }));
  assert.ok(g.hold); assert.equal(g.p1Sign, 'export_positive'); assert.equal(g.grid.importW, -1880);
  assert.equal(g.readings.net.raw.state, '1880'); assert.equal(M.netPresentation(g).value, '1,88 kW');
});

test('RC2 stale P1: vertraagd ⇒ grootte zonder teken, "niet live"; verouderd ⇒ "—"; offline ⇒ "—" zonder ruwe waarde', () => {
  const late = run('teruglevering', {}, () => ({ [ID.net]: SIM.st(ID.net, -1880, 'W', NOW, { ageS: 120 }) }));
  const p = M.netPresentation(late);
  assert.equal(p.value, '1,88 kW'); assert.equal(p.direction, 'none'); assert.match(p.sub, /Niet live · bevestigd 2 min geleden/);
  assert.equal(late.readings.net.raw.state, '-1880');
  const old = M.netPresentation(run('verouderd'));
  assert.equal(old.value, '—'); assert.match(old.sub, /Verouderd · 20 min/);
  const off = run('offline');
  assert.equal(M.netPresentation(off).value, '—'); assert.equal(off.readings.net.raw, null);
});

test('RC2 0 W en balans: "0 W", geen richting, normaal label', () => {
  const p = M.netPresentation(run('nul-watt'));
  assert.equal(p.value, '0 W'); assert.equal(p.direction, 'none'); assert.equal(p.sub, 'In balans');
});

test('RC2 herstel: zodra de netroute weer betrouwbaar actief is, normaal gedrag met teken en richting', () => {
  const a = A.createAdapter({});
  let m = M.computeModel(a.input(SIM.createHass('niet-synchroon', NOW), NOW));
  assert.equal(M.netPresentation(m).confirmed, false);
  m = M.computeModel(a.input(SIM.createHass('teruglevering', NOW + 2000), NOW + 2000), m);
  const p = M.netPresentation(m);
  assert.equal(p.confirmed, true); assert.equal(p.value, '−1,88 kW'); assert.equal(p.direction, 'export'); assert.equal(p.sub, 'Teruglevering aan het net');
  const i = M.netPresentation(run('afname'));
  assert.equal(i.value, '2,35 kW'); assert.equal(i.direction, 'import'); assert.equal(i.confirmed, true);
  // DEMO: zelfde regel (tegenstrijdige fictieve keten)
  const d = M.computeModel(M.scenarioInput('p1-fout', NOW));
  assert.equal(d.critical, true); assert.equal(M.netPresentation(d).direction, 'unconfirmed'); assert.doesNotMatch(M.netPresentation(d).value, /[−-]/);
});

// ======================================================================= 2. Actualiteits- en synchronisatiebeleid

test('RC2 beleid: gescheiden TTL’s en fail-safe behouden; 60/90 s en 10 s expliciet voorlopig', () => {
  assert.deepEqual({ ...C.PROVISIONAL }, { routeTtlS: true, balanceMaxSkewS: true, timestampsAreHaReports: true });
  assert.deepEqual(['net', 'house', 'pv', 'ev'].map(k => C.SOURCES[k].routeTtlS), [60, 60, 90, 90]);
  assert.deepEqual(['net', 'house', 'pv', 'ev'].map(k => C.SOURCES[k].ttlS), [300, 300, 2100, 2100]);
  assert.equal(C.BALANCE_SKEW_DEFAULT_S, 10);
  assert.equal(run('tegenstrijdig').critical, true);
  const src = fs.readFileSync(path.join(__dirname, '..', 'ha', 'contract.js'), 'utf8');
  assert.match(src, /VOORLOPIG \(RC2\): 60\/90 s/); assert.match(src, /VOORLOPIG \(RC2\): 10 s/);
});

test('RC2 last_reported wordt nergens voorgesteld als bewezen fysieke meettijd', () => {
  const texts = [];
  for (const id of Object.keys(SIM.SCENARIOS)) {
    const m = run(id);
    texts.push(m.balanceInfo, m.summary, m.status.text, ...m.warnings.map(w => w.text), ...Object.values(m.tiles).map(t => t.sub));
  }
  const all = texts.join(' | ');
  assert.doesNotMatch(all, /meettijd|meettijdstip|gemeten om/i);
  assert.match(run('niet-synchroon').balanceInfo, /HA-bronmeldingen lopen 30 s uiteen/);
  assert.match(run('afname').balanceInfo, /spreiding bronmeldingen/);
  // documentatie en detailpaneel zeggen het expliciet
  const doc = fs.readFileSync(path.join(__dirname, '..', 'ha', 'HA_DATA_CONTRACT.md'), 'utf8');
  assert.match(doc, /geen bewezen fysieke meettijd/); assert.match(doc, /benadering/);
  const master = fs.readFileSync(path.join(__dirname, '..', 'master.js'), 'utf8');
  assert.match(master, /tijdstip van de HA-statusmelding, geen bewezen fysieke meettijd/);
});
