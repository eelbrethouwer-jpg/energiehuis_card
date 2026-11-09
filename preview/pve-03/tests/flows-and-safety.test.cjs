'use strict';
// PVE-03 · route-geometrie, routecontract en statische veiligheidsgrenzen van de preview.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const F = require('../flows.js');
const ANCHORS = require('../assets/scene-anchors.js');

const DIR = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
// Code zonder commentaar: commentaar mag de verboden API's wél benoemen.
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
const RUNTIME = ['index.html', 'app.js', 'model.js', 'flows.js', 'styles.css', 'assets/scene-anchors.js'];

test('routecontract: kleuren per route, praktijk gestippeld, batterij nooit een route', () => {
  assert.deepEqual(Object.keys(F.STYLE).sort(), ['grid-home', 'home-ev', 'home-grid', 'home-practice', 'sun-home']);
  assert.equal(F.STYLE['sun-home'].color, '#FFC23D');
  assert.equal(F.STYLE['grid-home'].color, '#FF8A5B');
  assert.equal(F.STYLE['home-grid'].color, '#4BE38A');
  assert.equal(F.STYLE['home-ev'].color, '#33DDFF');
  assert.equal(F.STYLE['home-practice'].dashed, true);
  assert.match(F.STYLE['home-practice'].label, /SIMULATIE/);
  assert.equal(F.routePoints('battery', {}), null);
});

test('routerichting: begin- en eindpunt volgen de energierichting', () => {
  const p = { pv: { x: 1, y: 1 }, house: { x: 5, y: 5 }, grid: { x: 5, y: 9 }, cupra: { x: 9, y: 6 }, practice: { x: 1, y: 6 } };
  assert.deepEqual(F.routePoints('sun-home', p), [p.pv, p.house]);
  assert.deepEqual(F.routePoints('grid-home', p), [p.grid, p.house]);
  assert.deepEqual(F.routePoints('home-grid', p), [p.house, p.grid]);
  assert.deepEqual(F.routePoints('home-ev', p), [p.house, p.cupra]);
  assert.deepEqual(F.routePoints('home-practice', p), [p.house, p.practice]);
  const segs = F.segments([p.house, p.grid]);
  assert.deepEqual(segs[0][0], p.house);
  assert.deepEqual(segs[0][3], p.grid);
  const poly = F.polyline(segs);
  const a = F.at(poly, 0), b = F.at(poly, 1);
  assert.ok(Math.hypot(a.x - p.house.x, a.y - p.house.y) < 1e-6);
  assert.ok(Math.hypot(b.x - p.grid.x, b.y - p.grid.y) < 1e-6);
});

test('coverTransform: object-fit cover met centrering', () => {
  const t = F.coverTransform(1000, 1000, 2000, 1000);
  assert.equal(t.scale, 1); assert.equal(t.w, 2000); assert.equal(t.ox, -500); assert.equal(t.oy, 0);
  const c = F.mapPoint({ x: 0.5, y: 0.5 }, t);
  assert.deepEqual(c, { x: 500, y: 500 });
});

test('scène-ankers: beide composities, binnen beeld voor alle zichtbare objecten', () => {
  for (const layout of ['desktop', 'mobile']) {
    for (const k of ['pv', 'house', 'cupraPort', 'practice']) {
      const a = ANCHORS[layout][k];
      assert.ok(a && a.x > 0 && a.x < 1 && a.y > 0 && a.y < 1, layout + ' ' + k + ' ' + JSON.stringify(a));
    }
    // dak (zon) boven het huis, huis boven de Net-rij
    assert.ok(ANCHORS[layout].pv.y < ANCHORS[layout].house.y, layout);
  }
  // compositie: praktijk links, Cupra rechts, huis in het midden
  for (const layout of ['desktop', 'mobile']) {
    const A = ANCHORS[layout];
    assert.ok(A.practice.x < A.house.x && A.house.x < A.cupraPort.x + 0.2, layout);
    assert.ok(Math.abs(A.house.x - 0.5) < 0.06, layout);
  }
});

test('veiligheid: geen HA-, netwerk- of opslagaanroepen in de runtimebestanden', () => {
  const forbidden = /callService|callWS|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|\bhass\b|serviceWorker/;
  for (const f of RUNTIME) assert.doesNotMatch(code(f), forbidden, f);
  // geen grace-semantiek
  for (const f of ['model.js', 'flows.js', 'app.js']) assert.doesNotMatch(code(f), /graceMs|grace\s*:/, f);
  // geen externe bronnen (CDN, fonts, tracking)
  for (const f of ['index.html', 'styles.css']) assert.doesNotMatch(code(f), /https?:\/\//, f);
});

test('permanente DEMO-aanduiding aanwezig', () => {
  assert.match(read('index.html'), /DEMO — fictieve meetwaarden/);
  assert.match(read('app.js'), /DEMO — fictieve meetwaarden/);
  assert.match(read('index.html'), /noindex/);
});

test('beeldlagen: aanwezig, tekstvrij gegenereerd en binnen het gewichtsbudget', () => {
  const size = f => fs.statSync(path.join(DIR, 'assets', f)).size;
  const files = ['scene-desktop-1330', 'scene-desktop-2660', 'scene-mobile-540', 'scene-mobile-1080'];
  for (const b of files) for (const e of ['webp', 'jpg']) assert.ok(size(b + '.' + e) > 5000, b + '.' + e);
  // startweergave: grootste (2x) WebP per compositie
  assert.ok(size('scene-desktop-2660.webp') <= 1.5 * 1024 * 1024, 'desktop <= 1,5 MB');
  assert.ok(size('scene-mobile-1080.webp') <= 1.0 * 1024 * 1024, 'mobiel <= 1 MB');
  // de bron van de beeldlagen is de eigen generator, niet een foto van derden
  assert.match(read('tools/scene.html'), /geen foto's, geen logo's, geen externe modellen/);
});

test('F2-referentie is byte-identiek aan de aangeleverde bron', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'reference', 'claude-f2-standalone.html'))).digest('hex');
  assert.equal(h, 'f70a2d9ac9029bed1c2e56f23b284af90fe708c8445972e41ac6356b6313dd83');
});
