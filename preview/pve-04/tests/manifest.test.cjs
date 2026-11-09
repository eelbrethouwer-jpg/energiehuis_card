'use strict';
// PVE-04 · scènemanifest: bestanden, SHA-256, afmetingen, budgetten, maskers, ankerpunten en rechten.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const DIR = path.join(__dirname, '..');
const MF = require('../scene-manifest.js');
const { dims } = require('../tools/build-manifest.cjs');
const RIGHTS_MD = fs.readFileSync(path.join(DIR, 'ASSET_RIGHTS.md'), 'utf8');
const COMPS = Object.entries(MF.compositions);
const allAssets = () => COMPS.flatMap(([, c]) => [...c.base, ...c.masks]);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

test('schema en status: placeholder is gemarkeerd als niet visueel goedgekeurd', () => {
  assert.equal(MF.schema, 'energiehuis.scene-manifest/2');
  assert.equal(MF.coordinateSystem.id, 'normalized-image');
  assert.match(MF.coordinateSystem.mapping, /cover/);
  assert.ok(['placeholder', 'approved'].includes(MF.status));
  assert.deepEqual(Object.keys(MF.compositions).sort(), ['desktop', 'mobile']);
  if (MF.status !== 'approved') assert.match(MF.statusLabel, /niet visueel goedgekeurd/);
});

test('manifest is actueel: opnieuw bouwen geeft exact hetzelfde bestand', () => {
  const out = execFileSync(process.execPath, [path.join(DIR, 'tools', 'build-manifest.cjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /PASS/);
});

test('elk asset bestaat; bytes, SHA-256, type en afmetingen kloppen met het bestand', () => {
  for (const a of allAssets()) {
    const buf = fs.readFileSync(path.join(DIR, a.file));
    assert.equal(buf.length, a.bytes, a.file);
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), a.sha256, a.file);
    const d = dims(buf);
    assert.equal(d.type, a.type, a.file); assert.equal(d.w, a.w, a.file); assert.equal(d.h, a.h, a.file);
    assert.match(a.sha256, /^[0-9a-f]{64}$/);
  }
});

test('per compositie: WebP + JPEG-terugval, beeldverhouding gelijk aan natural, maskers met alfa', () => {
  for (const [name, c] of COMPS) {
    const ratio = c.natural.w / c.natural.h;
    assert.ok(c.base.some(b => b.type === 'image/webp') && c.base.some(b => b.type === 'image/jpeg'), name);
    for (const b of [...c.base, ...c.masks]) assert.ok(Math.abs(b.w / b.h - ratio) < 0.01, name + ' ' + b.file);
    assert.ok(c.masks.length >= 1, name + ' heeft een occlusiemasker');
    for (const m of c.masks) { assert.equal(m.type, 'image/png'); assert.equal(m.alpha, true, m.file); assert.match(m.semantics, /occlusie/); }
  }
  assert.ok(MF.compositions.desktop.natural.w > MF.compositions.desktop.natural.h, 'desktop liggend');
  assert.ok(MF.compositions.mobile.natural.h > MF.compositions.mobile.natural.w, 'mobiel staand');
});

test('budget: grootste startlaag (WebP 2×) + maskers binnen 1,5 MB desktop / 1 MB mobiel', () => {
  assert.equal(MF.compositions.desktop.budgetBytes, 1.5 * 1024 * 1024);
  assert.equal(MF.compositions.mobile.budgetBytes, 1.0 * 1024 * 1024);
  for (const [name, c] of COMPS) {
    const start = Math.max(...c.base.filter(b => b.type === 'image/webp').map(b => b.bytes)) + c.masks.reduce((s, m) => s + m.bytes, 0);
    const fallback = Math.max(...c.base.filter(b => b.type === 'image/jpeg').map(b => b.bytes)) + c.masks.reduce((s, m) => s + m.bytes, 0);
    assert.ok(start <= c.budgetBytes, `${name} ${start} > ${c.budgetBytes}`);
    assert.ok(fallback <= c.budgetBytes, `${name} JPEG-terugval ${fallback} > ${c.budgetBytes}`);
  }
});

test('rechten: elk asset verwijst naar een rechtenregel met alle verplichte velden, ook in ASSET_RIGHTS.md', () => {
  const required = ['title', 'origin', 'author', 'holder', 'license', 'proof', 'publicAllowed', 'visualStatus'];
  for (const a of allAssets()) {
    const r = MF.rights[a.rights];
    assert.ok(r, a.file + ' zonder rechtenregel');
    for (const k of required) assert.ok(r[k] !== undefined && r[k] !== '', `${a.rights}.${k}`);
    assert.equal(r.publicAllowed, true, a.file + ' mag niet publiek in de repository');
    assert.ok(RIGHTS_MD.includes(a.rights), a.rights + ' ontbreekt in ASSET_RIGHTS.md');
    assert.ok(RIGHTS_MD.includes(a.sha256), a.file + ' SHA-256 ontbreekt in ASSET_RIGHTS.md');
  }
  if (MF.status !== 'approved') for (const r of Object.values(MF.rights)) assert.match(r.visualStatus, /NIET visueel goedgekeurd/);
});

test('geen ongeregistreerde of verboden bestanden: alleen manifest-assets in assets/, geen ruwe modellen', () => {
  const registered = new Set(allAssets().map(a => path.normalize(a.file)));
  for (const f of fs.readdirSync(path.join(DIR, 'assets'))) assert.ok(registered.has(path.normalize('assets/' + f)), 'ongeregistreerd: assets/' + f);
  const RAW = /\.(blend\d?|fbx|obj|mtl|max|c4d|ma|mb|3ds|dae|glb|gltf|usd[acz]?|abc|exr|hdr|psd|tiff?|zip|7z|rar)$/i;
  for (const f of walk(DIR)) assert.doesNotMatch(f, RAW, 'verboden ruw bronbestand: ' + path.relative(DIR, f));
  const gi = fs.readFileSync(path.join(DIR, '.gitignore'), 'utf8');
  for (const pat of ['*.blend', '*.fbx', '*.glb', '*.exr', '*.hdr', 'raw/', 'licenses-private/']) assert.ok(gi.split('\n').includes(pat), '.gitignore mist ' + pat);
});

test('ankerpunten: verplichte objecten per compositie aanwezig en in beeld', () => {
  for (const [name, c] of COMPS) {
    for (const k of ['pv', 'house', 'cupraPort', 'practice', 'charger']) {
      const a = c.anchors[k];
      assert.ok(a && Number.isFinite(a.x) && Number.isFinite(a.y), name + ' ' + k);
      if (k !== 'charger') assert.ok(a.x > 0 && a.x < 1 && a.y > 0 && a.y < 1, `${name} ${k} buiten beeld ${JSON.stringify(a)}`);
    }
  }
});

test('manifest laadt zonder netwerk: puur data, geen fetch/import/XHR', () => {
  const src = fs.readFileSync(path.join(DIR, 'scene-manifest.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /fetch\s*\(|XMLHttpRequest|import\s*\(|https?:\/\//);
  for (const a of allAssets()) assert.doesNotMatch(a.file, /^(https?:|\/\/|\/)/, 'alleen relatieve, lokale paden');
});
