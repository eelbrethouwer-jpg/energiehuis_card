'use strict';
/*
 * PVE-04 · bouwt master-scene.js uit cleanplate/overlay-map.json en de goedgekeurde master.
 *   node preview/pve-04/tools/build-master-scene.cjs           # schrijft master-scene.js
 *   node preview/pve-04/tools/build-master-scene.cjs --check   # faalt bij elke afwijking (CI/tests)
 *
 * De master (preview/pve-03/reference/approved-visual-20261109.webp) staat al in de repository en wordt
 * NIET gekopieerd: de preview verwijst ernaar. Er worden geen afgeleide beeldbestanden gemaakt.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, '..');
const MAP = JSON.parse(fs.readFileSync(path.join(DIR, 'cleanplate', 'overlay-map.json'), 'utf8'));
const MASTER_REL = '../pve-03/reference/approved-visual-20261109.webp';
const MASTER_ABS = path.join(DIR, MASTER_REL);
const OUT = path.join(DIR, 'master-scene.js');

const W = MAP.master.w, H = MAP.master.h;
const sha = crypto.createHash('sha256').update(fs.readFileSync(MASTER_ABS)).digest('hex');
if (sha !== MAP.master.sha256) throw new Error(`master-SHA wijkt af van overlay-map: ${sha}`);

// Afdekmarge rond ingebakken kaarten (natuurlijke px): gloed en rand vallen binnen de kaartmaat + 6 px,
// de slagschaduw onderaan reikt iets verder (+8 px). Gemeten op 300 % (pilot 1B-a).
const MARGIN = { x: 6, top: 6, bottom: 8 };
const COVER = { 'card-pv': 'pv', 'card-battery': 'battery', 'card-house': 'house', 'card-practice': 'practice', 'card-net': 'net', 'card-cupra': 'cupra', 'datetime-pill': 'pill' };
const r4 = v => Math.round(v * 10000) / 10000;

const covers = {};
for (const o of MAP.overlays) {
  const key = COVER[o.id];
  if (!key) continue;
  const x0 = Math.max(0, o.x - MARGIN.x / W), y0 = Math.max(0, o.y - MARGIN.top / H);
  const x1 = Math.min(1, o.x + o.w + MARGIN.x / W), y1 = Math.min(1, o.y + o.h + MARGIN.bottom / H);
  covers[key] = { overlay: o.id, baked: { x: o.x, y: o.y, w: o.w, h: o.h }, x: r4(x0), y: r4(y0), w: r4(x1 - x0), h: r4(y1 - y0) };
}

// Ingebakken stroomlijnen → modelroutes. `reverse`: de punten in de overlay-map lopen tegen de stroomrichting in.
// `glow`: straal van de gloed rond de lijn als factor van de halve lijnbreedte (pv-gloed is het breedst).
const FLOWS = {
  'flow-pv': { group: 'pv', routes: { 'sun-home': false }, glow: 2.8, particles: true, color: '#FFC83D' },
  'flow-practice': { group: 'practice', routes: { 'home-practice': true }, glow: 2.4, particles: true, color: '#F4F1EA' },
  'flow-net': { group: 'net', routes: { 'home-grid': false, 'grid-home': true }, glow: 2.4, particles: true, color: '#3FE6F2' },
  'flow-car': { group: 'ev', routes: { 'home-ev': false }, glow: 2.4, particles: true, color: '#7CFF4A' },
  'flow-card-car': { group: 'ev', routes: { 'home-ev': false }, glow: 2.2, particles: false, color: '#7CFF4A' }
};
const flows = [];
for (const o of MAP.overlays) {
  const f = FLOWS[o.id];
  if (!f) continue;
  flows.push({ id: o.id, group: f.group, routes: f.routes, particles: f.particles, color: f.color, width: o.width, glow: f.glow, points: o.points.map(p => [r4(p[0]), r4(p[1])]) });
}
for (const id of Object.keys(FLOWS)) if (!flows.some(f => f.id === id)) throw new Error('stroomlijn ontbreekt in overlay-map: ' + id);

const scene = {
  schema: 'energiehuis.master-scene/1',
  status: 'approved',
  approvedBy: 'eigenaar, 9 november 2026 (definitieve visuele referentie, ingebakken kaarten/stromen geaccepteerd)',
  coordinateSystem: 'normalized-image (0..1 van natural w/h, oorsprong linksboven)',
  image: { file: MASTER_REL, type: 'image/webp', natural: { w: W, h: H }, bytes: fs.statSync(MASTER_ABS).size, sha256: sha },
  margin: MARGIN,
  covers,
  flows,
  keep: ['header-logo', 'header-title', 'car-plate', 'car-logo']
};

const body = `/* GEGENEREERD door tools/build-master-scene.cjs uit cleanplate/overlay-map.json — niet met de hand bewerken.
 * Energiehuis PVE-04 · goedgekeurde master als vaste achtergrond: afdekvlakken voor de ingebakken kaarten en
 * de geometrie van de ingebakken stroomlijnen (genormaliseerde beeldcoördinaten). Puur data, geen netwerk. */
(function (root) {
  'use strict';
  const SCENE = ${JSON.stringify(scene, null, 2).replace(/\n/g, '\n  ')};
  const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
  if (typeof module === 'object' && module.exports) module.exports = deepFreeze(SCENE);
  else root.EhPve04MasterScene = deepFreeze(SCENE);
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== body) { console.error('master-scene.js is niet actueel: draai tools/build-master-scene.cjs'); process.exit(1); }
  console.log('master-scene.js actueel (SHA master ' + sha.slice(0, 12) + '…)');
} else {
  fs.writeFileSync(OUT, body);
  console.log('master-scene.js geschreven: ' + Object.keys(covers).length + ' afdekvlakken, ' + flows.length + ' stroomlijnen');
}
