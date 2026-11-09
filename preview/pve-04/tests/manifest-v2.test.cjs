'use strict';
// PVE-04 · manifest v2 (zones, beschermde gebieden, lichtlagen) en runtimevalidatie (validateManifest).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../manifest-validate.js');
const F = require('../flows.js');
const MF = require('../scene-manifest.js');

const clone = () => JSON.parse(JSON.stringify(MF));
const bad = (mutate) => { const m = clone(); mutate(m); return V.validateManifest(m); };
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const inside = (a, b) => a.x >= b.x - 1e-4 && a.y >= b.y - 1e-4 && a.x + a.w <= b.x + b.w + 1e-4 && a.y + a.h <= b.y + b.h + 1e-4;

test('het actuele manifest is geldig (v2)', () => {
  const r = V.validateManifest(MF);
  assert.deepEqual(r, { ok: true, version: 2, errors: [] });
});

test('v1-manifest (zonder v2-velden) blijft geldig: achterwaarts compatibel', () => {
  const m = clone(); m.schema = 'energiehuis.scene-manifest/1'; delete m.coordinateSystem;
  for (const c of Object.values(m.compositions)) { delete c.uiZones; delete c.keyObjects; delete c.protectedAreas; delete c.lightLayers; delete c.outOfView; }
  assert.equal(V.validateManifest(m).ok, true);
});

test('lichtlagen zijn uitbreidbaar: geldige laag + onbekende extra velden toegestaan; ongeldige laag geweigerd', () => {
  const m = clone(); const b = m.compositions.desktop.base[0];
  m.compositions.desktop.lightLayers = [{ ...b, id: 'praktijk-licht', blend: 'screen', trigger: 'practice-linked', toekomstigVeld: { a: 1 } }];
  assert.equal(V.validateManifest(m).ok, true);
  m.compositions.desktop.lightLayers[0].blend = 'difference';
  assert.equal(V.validateManifest(m).ok, false);
  delete m.compositions.desktop.lightLayers[0].blend; delete m.compositions.desktop.lightLayers[0].trigger;
  assert.match(V.validateManifest(m).errors.join(), /trigger/);
});

// ---- negatieve gevallen (≥ 12): elk geeft ok:false met een leesbare melding en gooit nooit
const NEG = {
  'null': () => V.validateManifest(null),
  'geen object (getal)': () => V.validateManifest(42),
  'array': () => V.validateManifest([]),
  'onbekend schema': () => bad(m => { m.schema = 'iets/9'; }),
  'base ontbreekt': () => bad(m => { delete m.compositions.desktop.base; }),
  'base leeg': () => bad(m => { m.compositions.mobile.base = []; }),
  'geen JPEG-terugval': () => bad(m => { m.compositions.desktop.base = m.compositions.desktop.base.filter(b => b.type !== 'image/jpeg'); }),
  'natural ontbreekt': () => bad(m => { delete m.compositions.desktop.natural; }),
  'natural 0': () => bad(m => { m.compositions.mobile.natural.w = 0; }),
  'compositie ontbreekt': () => bad(m => { delete m.compositions.mobile; }),
  'masker zonder alpha': () => bad(m => { delete m.compositions.desktop.masks[0].alpha; }),
  'masker zonder semantics': () => bad(m => { delete m.compositions.desktop.masks[0].semantics; }),
  'masker als jpeg': () => bad(m => { m.compositions.desktop.masks[0].type = 'image/jpeg'; }),
  'pad met ..': () => bad(m => { m.compositions.desktop.base[0].file = 'assets/../../secret.webp'; }),
  'absolute URL': () => bad(m => { m.compositions.desktop.base[0].file = 'https://example.org/x.webp'; }),
  'javascript:-pad': () => bad(m => { m.compositions.desktop.masks[0].file = 'javascript:alert(1)'; }),
  'pad buiten assets/': () => bad(m => { m.compositions.desktop.base[0].file = 'index.html'; }),
  'extensie past niet bij type': () => bad(m => { m.compositions.desktop.base[0].file = 'assets/x.png'; }),
  'sha256 ongeldig': () => bad(m => { m.compositions.desktop.base[1].sha256 = 'abc'; }),
  'verplicht anker ontbreekt': () => bad(m => { delete m.compositions.desktop.anchors.house; }),
  'anker NaN': () => bad(m => { m.compositions.mobile.anchors.pv.x = NaN; }),
  'uiZone buiten beeld': () => bad(m => { m.compositions.desktop.uiZones[0].x = 0.9; }),
  'uiZone voor kaart ontbreekt': () => bad(m => { m.compositions.mobile.uiZones = m.compositions.mobile.uiZones.filter(z => z.id !== 'net'); }),
  'onbekende rechten-ID': () => bad(m => { m.compositions.desktop.base[0].rights = 'R-ONBEKEND'; }),
  'getter die gooit': () => { const m = clone(); Object.defineProperty(m, 'compositions', { get() { throw new Error('boem'); } }); return V.validateManifest(m); }
};
for (const [name, run] of Object.entries(NEG)) {
  test('negatief: ' + name, () => {
    let r; assert.doesNotThrow(() => { r = run(); });
    assert.equal(r.ok, false, name);
    assert.ok(Array.isArray(r.errors) && r.errors.length > 0 && r.errors.every(e => typeof e === 'string' && e.length > 5), name);
  });
}
test('aantal negatieve tests ≥ 12', () => assert.ok(Object.keys(NEG).length >= 12));

test('safePath: alleen relatieve paden binnen assets/', () => {
  for (const ok of ['assets/a.webp', 'assets/mask-desktop-1330.png']) assert.equal(V.safePath(ok), true, ok);
  for (const no of ['assets/../x.png', '/assets/a.png', '//cdn/x.png', 'http://x/a.png', 'assets/sub/a.png', 'assets/.hidden.png', 'assets/a b.png', '', null]) assert.equal(V.safePath(no), false, String(no));
});

test('coördinaten: zones, sleutelobjecten en beschermde gebieden binnen 0..1; zones overlappen niet', () => {
  for (const [name, c] of Object.entries(MF.compositions)) {
    for (const r of [...c.uiZones, ...c.protectedAreas, ...Object.values(c.keyObjects)]) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001, name + ' ' + JSON.stringify(r));
    for (let i = 0; i < c.uiZones.length; i++) for (let j = i + 1; j < c.uiZones.length; j++) assert.ok(overlap(c.uiZones[i], c.uiZones[j]) < 1e-9, `${name}: ${c.uiZones[i].id} overlapt ${c.uiZones[j].id}`);
    for (const pa of c.protectedAreas) assert.ok(inside(pa, c.keyObjects[pa.from]), `${name}: ${pa.id} niet binnen ${pa.from}`);
    assert.ok(['car', 'practice-front', 'pv', 'house-upper'].every(id => c.protectedAreas.some(p => p.id === id)), name);
    for (const m of c.masks) assert.ok(m.bbox && inside(m.bbox, { x: 0, y: 0, w: 1, h: 1 }), name + ' maskerkader');
  }
});

test('responsieve mapping: beschermde gebieden blijven op alle afgesproken schermformaten (deels) in beeld', () => {
  const stages = { mobile: [[296, 527], [366, 651]], desktop: [[736, 414], [1159, 652], [1376, 774]] };
  for (const [name, sizes] of Object.entries(stages)) {
    const c = MF.compositions[name];
    for (const [w, h] of sizes) {
      const t = F.coverTransform(w, h, c.natural.w, c.natural.h);
      for (const pa of c.protectedAreas) {
        const x0 = t.ox + pa.x * t.w, y0 = t.oy + pa.y * t.h, x1 = x0 + pa.w * t.w, y1 = y0 + pa.h * t.h;
        const vis = Math.max(0, Math.min(x1, w) - Math.max(x0, 0)) * Math.max(0, Math.min(y1, h) - Math.max(y0, 0));
        assert.ok(vis / ((x1 - x0) * (y1 - y0)) > 0.95, `${name} ${w}×${h}: ${pa.id} grotendeels buiten beeld`);
      }
    }
  }
});
