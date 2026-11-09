'use strict';
// PVE-04 · master-scène: consistent met de overlay-map, de goedgekeurde master en het routecontract van model.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const S = require('../master-scene.js');
const M = require('../model.js');
const DIR = path.join(__dirname, '..');
const MAP = JSON.parse(fs.readFileSync(path.join(DIR, 'cleanplate', 'overlay-map.json'), 'utf8'));

test('master-scene.js is actueel (build-master-scene --check)', () => {
  const out = execFileSync(process.execPath, [path.join(DIR, 'tools', 'build-master-scene.cjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /actueel/);
});

test('verwijst naar de bestaande, goedgekeurde master (geen kopie, SHA-256 klopt)', () => {
  assert.equal(S.status, 'approved');
  assert.equal(S.image.file, '../pve-03/reference/approved-visual-20261109.webp');
  const buf = fs.readFileSync(path.join(DIR, S.image.file));
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), S.image.sha256);
  assert.equal(S.image.sha256, MAP.master.sha256);
  assert.deepEqual(S.image.natural, { w: 1330, h: 748 });
  // geen kopie of afgeleid beeld van de master in pve-04
  for (const f of fs.readdirSync(path.join(DIR, 'assets'))) assert.doesNotMatch(f, /approved|master|cleanplate/i, f);
});

test('afdekvlakken bevatten elke ingebakken kaart + marge (≥ 5 px) en blijven binnen beeld', () => {
  const W = S.image.natural.w, H = S.image.natural.h;
  for (const key of ['pv', 'battery', 'house', 'practice', 'net', 'cupra', 'pill']) {
    const c = S.covers[key]; assert.ok(c, key);
    const o = MAP.overlays.find(x => x.id === c.overlay);
    assert.ok(c.x <= o.x - 5 / W + 1e-4 || c.x === 0, key + ' links');
    assert.ok(c.y <= o.y - 5 / H + 1e-4 || c.y === 0, key + ' boven');
    assert.ok(c.x + c.w >= o.x + o.w + 5 / W - 1e-4 || c.x + c.w >= 0.9999, key + ' rechts');
    assert.ok(c.y + c.h >= o.y + o.h + 7 / H - 1e-4, key + ' onder (schaduw)');
    assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001, key + ' binnen beeld');
  }
  // afdekvlakken overlappen elkaar niet
  const list = Object.entries(S.covers);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [ka, a] = list[i], [kb, b] = list[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), ka + '/' + kb);
  }
});

test('stroomlijnen: elke ingebakken lijn hoort bij bekende modelroutes; batterij heeft geen lijn', () => {
  const ids = S.flows.map(f => f.id).sort();
  assert.deepEqual(ids, ['flow-car', 'flow-card-car', 'flow-net', 'flow-practice', 'flow-pv']);
  for (const f of S.flows) {
    for (const r of Object.keys(f.routes)) assert.ok(M.ROUTES.includes(r), f.id + ' ' + r);
    assert.ok(f.points.length >= 2 && f.width > 0 && f.glow >= 1, f.id);
    for (const p of f.points) assert.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1, f.id);
  }
  // richting: net-lijn loopt in de overlay-map van huis naar net (teruglevering = vooruit, afname = achteruit)
  const net = S.flows.find(f => f.id === 'flow-net');
  assert.deepEqual(net.routes, { 'home-grid': false, 'grid-home': true });
  assert.ok(net.points[0][1] < net.points[net.points.length - 1][1], 'huis boven, net onder');
  assert.ok(!S.flows.some(f => f.group === 'battery'));
  assert.ok(Object.isFrozen(S) && Object.isFrozen(S.flows[0].points));
});

test('model: scenario "0 W" zet alle routes uit en blijft sluitend', () => {
  const m = M.computeModel(M.scenarioInput('nul-watt', Date.parse('2026-11-09T18:00:00Z')));
  assert.ok(Object.values(m.routes).every(r => !r.active));
  assert.equal(m.critical, false);
  assert.equal(m.tiles.net.value, '0 W');
  assert.equal(m.tiles.practice.sub, 'Nog niet gekoppeld');
  assert.equal(m.tiles.battery.tone, 'sim');
});
