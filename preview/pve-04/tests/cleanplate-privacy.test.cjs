'use strict';
// PVE-04 · stap 1A: clean-plate-workflow, privémanifest en scheiding publiek/privé.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const V = require('../manifest-validate.js');
const BM = require('../tools/build-manifest.cjs');
const PUB = require('../scene-manifest.js');

const DIR = path.join(__dirname, '..');
const REPO = path.join(DIR, '..', '..');
const OMAP = JSON.parse(fs.readFileSync(path.join(DIR, 'cleanplate', 'overlay-map.json'), 'utf8'));
const TPL = JSON.parse(fs.readFileSync(path.join(DIR, 'cleanplate', 'scene-source.template.json'), 'utf8'));

function privateManifest(over = {}) {
  const c = JSON.parse(JSON.stringify(PUB.compositions.desktop));
  for (const e of [...c.base, ...c.masks]) e.rights = 'R-P';
  return { schema: 'energiehuis.scene-manifest/2', coordinateSystem: PUB.coordinateSystem, sceneId: 'x', visibility: 'private', assetBase: 'private/x/', status: 'placeholder', statusLabel: 'x', compositions: { desktop: c }, rights: { 'R-P': { title: 't', origin: 'o', author: 'a', holder: 'h', license: 'privé', proof: 'p', publicAllowed: false, visualStatus: 'concept' } }, ...over };
}

test('privacy: private/ staat in .gitignore en er is geen enkel bestand onder private/ getrackt', () => {
  assert.ok(fs.readFileSync(path.join(DIR, '.gitignore'), 'utf8').split('\n').includes('private/'));
  const tracked = execFileSync('git', ['ls-files', '--', 'preview/pve-04'], { cwd: REPO, encoding: 'utf8' }).split('\n');
  assert.deepEqual(tracked.filter(f => /\/private\//.test(f)), []);
  const probe = spawnSync('git', ['check-ignore', '-q', 'preview/pve-04/private/x/scene-manifest.private.js'], { cwd: REPO });
  assert.equal(probe.status, 0, 'private/ wordt niet genegeerd');
});

test('privacy: het publieke manifest verwijst nooit naar rechten met publicAllowed:false', () => {
  for (const r of Object.values(PUB.rights)) assert.equal(r.publicAllowed, true);
  assert.notEqual(PUB.visibility, 'private');
});

test('privacy: overlay-map en sjabloon bevatten alleen getallen/tekst, geen beelddata', () => {
  for (const f of ['overlay-map.json', 'scene-source.template.json']) {
    const s = fs.readFileSync(path.join(DIR, 'cleanplate', f), 'utf8');
    assert.ok(s.length < 20000, f);
    assert.doesNotMatch(s, /data:image|base64,|[A-Za-z0-9+/]{200,}/, f);
  }
  assert.equal(TPL.rights[TPL.rightsId].publicAllowed, false);
});

test('overlay-map: volledig, binnen 0..1 en met methode/moeilijkheid per overlay', () => {
  assert.equal(OMAP.schema, 'energiehuis.cleanplate-overlay-map/1');
  assert.match(OMAP.master.sha256, /^[0-9a-f]{64}$/);
  const kinds = new Set(OMAP.overlays.map(o => o.kind));
  for (const k of ['text', 'card', 'flow', 'logo', 'plate']) assert.ok(kinds.has(k), 'ontbreekt: ' + k);
  for (const o of OMAP.overlays) {
    assert.ok(['laag', 'middel', 'hoog'].includes(o.difficulty), o.id);
    assert.ok(['auto-inpaint', 'patch-clone', 'herschilderen', 'regenereren'].includes(o.method), o.id);
    const pts = o.shape === 'rect' ? [[o.x, o.y], [o.x + o.w, o.y + o.h]] : o.points;
    for (const [x, y] of pts) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, o.id);
  }
  assert.equal(new Set(OMAP.overlays.map(o => o.id)).size, OMAP.overlays.length);
});

test('master-hash in de overlay-map komt overeen met de referentie (indien aanwezig)', () => {
  const f = path.join(REPO, OMAP.master.file);
  if (!fs.existsSync(f)) return;
  const h = require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  assert.equal(h, OMAP.master.sha256);
});

test('cleanplate.py weigert beeldoutput buiten private/', () => {
  const r = spawnSync('python3', [path.join(DIR, 'tools', 'cleanplate.py'), 'mask', '--out', path.join(DIR, 'assets')], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /Weigering/);
  assert.equal(fs.existsSync(path.join(DIR, 'assets', 'overlay-mask.png')), false);
});

test('build-manifest --private weigert mappen buiten private/', () => {
  assert.throws(() => BM.buildPrivate(path.join(DIR, 'assets')), /onder preview\/pve-04\/private/);
  assert.throws(() => BM.buildPrivate('/tmp/elders'), /onder preview\/pve-04\/private/);
});

test('validator: privémanifest (alleen desktop) geldig; publicAllowed:true, onveilige assetBase of geen compositie ongeldig', () => {
  assert.deepEqual(V.validateManifest(privateManifest()).errors, []);
  assert.equal(V.validateManifest(privateManifest({ assetBase: '/local/energiehuis/pve04/' })).ok, true);
  const leak = privateManifest(); leak.rights['R-P'].publicAllowed = true;
  assert.match(V.validateManifest(leak).errors.join(), /publicAllowed:false/);
  for (const b of ['https://x/', '../private/', '/config/www/', 'private', '//local/x/', '/local/../x/']) assert.equal(V.validateManifest(privateManifest({ assetBase: b })).ok, false, b);
  assert.equal(V.validateManifest(privateManifest({ compositions: {} })).ok, false);
  assert.equal(V.validateManifest(privateManifest({ visibility: 'geheim' })).ok, false);
});

test('safeManifestUrl: alleen same-origin .js onder private/ of /local/', () => {
  for (const ok of ['private/scene-manifest.private.js', 'private/a/b.js', '/local/energiehuis/pve04/scene-manifest.private.js']) assert.equal(V.safeManifestUrl(ok), true, ok);
  for (const no of ['https://evil.example/x.js', '//evil/x.js', 'private/../x.js', '/config/x.js', 'private/x.json', 'javascript:alert(1)', '']) assert.equal(V.safeManifestUrl(no), false, no);
});
